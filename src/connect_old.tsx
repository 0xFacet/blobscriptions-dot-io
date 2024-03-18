import { Block } from '@ethereumjs/block'
import { Chain, Common, Hardfork } from '@ethereumjs/common'
import { BlobEIP4844Transaction, FeeMarketEIP1559Transaction } from '@ethereumjs/tx'
import { Kzg, SECP256K1_ORDER_DIV_2, bytesToBigInt, bytesToHex, bytesToUtf8, hexToBytes, initKZG, randomBytes } from '@ethereumjs/util'
import { useConnectWallet } from '@web3-onboard/react'
import { createKZG } from 'kzg-wasm'
import { useEffect, useState } from 'react'

const getString = (blob:Uint8Array) => {
  const end = blob.findIndex((_, idx, arr) => {
  return arr[idx] === 0x80 && arr[idx + 1] === 0
})
  return bytesToUtf8(blob.slice(0, end))
}

export default function ConnectButton() {
  const [kzg, setKzg] = useState<Kzg>()
  const [hash, setHash] = useState<string>('')
  const [msg, setMsg] = useState<string>('')
  const [blobVal, setVal] = useState<string>('')
  const [timestamp, setTs] = useState<number>(0)
  useEffect(() => {
    const init = async () => {
      const kzg = await createKZG()
      initKZG(kzg, '')
      setKzg(kzg)
    }
    init()
  }, [])
  const [{ wallet, connecting }, connect, disconnect] = useConnectWallet()
  const sendTx = async () => {

    const tip = await wallet!.provider.request({
      "method": "eth_feeHistory",
      "params": ['0x1', 'latest', [0.5]]
    }) as any
    const blockData = await wallet!.provider.request({
      "method": "eth_getBlockByNumber", "params": ["latest", false]
    }) as any
    console.log('tip', tip)
    const common = new Common({ chain: Chain.Sepolia, hardfork: Hardfork.Cancun , customCrypto: { kzg }})
    const block = Block.fromRPC(blockData, undefined, { common })
    const blobTx = BlobEIP4844Transaction.fromTxData({ blobsData: [blobVal], to: '0xff00000000000000000000000000000000074248', gasLimit: 0x5208, maxFeePerGas: parseInt(tip.baseFeePerGas[0] + 5), maxFeePerBlobGas: block.header.getBlobGasPrice(), maxPriorityFeePerGas: parseInt(tip.reward[0])}, { common })

    let signedTx 
    let done = false
    while (!done) {
    const r = randomBytes(32)
    let s = randomBytes(32)
    while (bytesToBigInt(s) > SECP256K1_ORDER_DIV_2) {
      s = randomBytes(32)
    }
    const v = 0n
        // Generate
        signedTx = blobTx?.addSignature(v, r, s)
        done = signedTx.verifySignature()
    }
    const upFrontCost = blobTx.getUpfrontCost(BigInt(tip.baseFeePerGas[1])) * 1000n
  //  const maxFee = parseInt(tip.baseFeePerGas[1]) > parseInt(tip.reward[0]) ? parseInt(tip.baseFeePerGas[1]) : parseInt(tip.reward[0])
    const nonce = await wallet!.provider.request({
      "method": "eth_getTransactionCount",
      "params": [wallet?.accounts[0].address ]
    }) as string
    const tx = FeeMarketEIP1559Transaction.fromTxData({ nonce: parseInt(nonce), to: signedTx!.getSenderAddress(), value: upFrontCost, gasLimit: 0x5208, maxFeePerGas: parseInt(tip.baseFeePerGas[0] + 5), maxPriorityFeePerGas: parseInt(tip.reward[0])  })
    console.log(blobTx.toJSON())
    const res = await wallet!.provider.request({
      "method": "eth_sendTransaction",
      "params": [{...tx.toJSON(), ...{"from": wallet?.accounts[0].address}} ]
    })
    console.log('tx hash', res)
    done = false
    while (!done) {
      console.log('lets get a transaction receipt')
      const receipt = await wallet?.provider.request({
        "method": "eth_getTransactionReceipt",
        "params": [res]
      }) as any
      if (receipt === undefined || receipt === null) {
        console.log('tx not mined yet')
        await new Promise((resolve) => setTimeout(resolve, 12000))
      } else {
        done = true
      }
    }
    console.log('Blob sender address', signedTx!.getSenderAddress().toString())
    const signedTxHash = await wallet!.provider.request({
      "method": "eth_sendRawTransaction",
      "params": [bytesToHex(signedTx!.serializeNetworkWrapper())]
    }) as string
    if (signedTxHash !== null) setHash(signedTxHash)
    done = false
    while (!done) {
      console.log('lets get a transaction receipt')
      const receipt = await wallet?.provider.request({
        "method": "eth_getTransactionReceipt",
        "params": [signedTxHash]
      }) as any
      if (receipt === undefined || receipt === null) {
        console.log('tx not mined yet')
        await new Promise((resolve) => setTimeout(resolve, 12000))
      } else {
        done = true
        console.log(receipt)
        const minedBlock = await wallet?.provider.request({
          "method": "eth_getBlockByNumber",
          "params": ['latest', false]
        }) as any
        console.log(minedBlock)
        setTs(parseInt(minedBlock.timestamp))
      }
    }
  }

  const getBlobFromBeacon = async () => {
    console.log('lets get a blob')
    const holeskyGenesisTime = 1695902400
    const slot = (timestamp - holeskyGenesisTime) / 12
    console.log(slot)
    const rest = await fetch(`https://lodestar-holesky.chainsafe.io/eth/v1/beacon/blob_sidecars/${slot.toString()}`)
    const blobs = await rest.json()
    console.log('we got a response', blobs)
    for (const blob of blobs.data) {
      const message = getString(hexToBytes(blob.blob))
      console.log(message, blobVal)
      if (message === blobVal)
        alert(`Found your blob in index ${blob.index} of Beacon Block ${slot}`)
    }
  }

  return (
    <div>
     {wallet === null && <button
        disabled={connecting}
        onClick={() => connect()}>
        Connect Web3
      </button>}
      {wallet !== null && wallet.provider && <button onClick={() => disconnect(wallet)}>Disconnect</button>}
      <div>
        <p>Enter the text you would like impermenantly stored on the Beacon Chain and click "Create Blob" </p>
        <input type="text" value={msg} onInputCapture={(e) => setMsg(e.currentTarget.value)}></input><button onClick={() => { 
          setVal(msg)
          setMsg('')
        }}>Create Blob</button></div>
        <div>
      {wallet !== null && 
        <>
          <p>This transaction sends Holesky ETH to a burner wallet that is used to create your blob and post it to the Beacon Network</p>
          <button onClick={sendTx}>Send Tx</button>
        </>}
      </div>
      <div>

      {hash.length > 0 && <>
        <div>Your blob tx is <a href={`https://blobscan.com/tx/${hash}`} target={'_blank'}>{hash}</a></div>
        <p>If all goes well, it should show up on the Beacon Chain in a bit.</p>
        <button onClick={() => getBlobFromBeacon()}>Look for Blob</button>
      </>}
      </div>
      </div>
  )}