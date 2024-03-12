import { Block } from '@ethereumjs/block'
import { Chain, Common, Hardfork } from '@ethereumjs/common'
import { BlobEIP4844Transaction, FeeMarketEIP1559Transaction } from '@ethereumjs/tx'
import { Kzg, SECP256K1_ORDER_DIV_2, bytesToBigInt, bytesToHex, bytesToUtf8, initKZG, randomBytes } from '@ethereumjs/util'
import { useConnectWallet } from '@web3-onboard/react'
import { createKZG } from 'kzg-wasm'
import { useEffect, useState } from 'react'

const getString = (blob:Uint8Array) => {
  const end = blob.findIndex((_, idx, arr) => {
  return arr[idx] === 0x80 && arr[idx + 1] === 0
})
  const message = bytesToUtf8(blob.slice(0, end))
}

export default function ConnectButton() {
  const [kzg, setKzg] = useState<Kzg>()
  const [hash, setHash] = useState<string>('')
  const [msg, setMsg] = useState<string>('')
  const [blobVal, setVal] = useState<string>('')
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
    const common = new Common({ chain: Chain.Holesky, hardfork: Hardfork.Cancun , customCrypto: { kzg }})
    const block = Block.fromRPC(blockData, undefined, { common })
    const blobTx = BlobEIP4844Transaction.fromTxData({ nonce: 0x0, blobsData: [blobVal], to: '0xff00000000000000000000000000000000074248', gasLimit: 0x5208, maxFeePerGas: parseInt(tip.baseFeePerGas[0] + 5), maxFeePerBlobGas: block.header.getBlobGasPrice(), maxPriorityFeePerGas: parseInt(tip.reward[0])}, { common })

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
    const maxFee = parseInt(tip.baseFeePerGas[1]) > parseInt(tip.reward[0]) ? parseInt(tip.baseFeePerGas[1]) : parseInt(tip.reward[0])
    const nonce = await wallet!.provider.request({
      "method": "eth_getTransactionCount",
      "params": [wallet?.accounts[0].address ]
    }) as string
    const tx = FeeMarketEIP1559Transaction.fromTxData({ nonce: parseInt(nonce), to: signedTx.getSenderAddress(), value: upFrontCost, gasLimit: 0x5208 })
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
    console.log(signedTx!.getSenderAddress().toString())
    const signedTxHash = await wallet!.provider.request({
      "method": "eth_sendRawTransaction",
      "params": [bytesToHex(signedTx!.serializeNetworkWrapper())]
    }) as string
    if (signedTxHash !== null) setHash(signedTxHash)


  }

  return (
    <div>
     {wallet === null && <button
        disabled={connecting}
        onClick={() => connect()}>
        Connect
      </button>}
      {wallet !== null && wallet.provider && <button onClick={() => disconnect(wallet)}>Disconnect</button>}
      <div><input type="text" value={msg} onInputCapture={(e) => setMsg(e.currentTarget.value)}></input><button onClick={() => { 
          setVal(msg)
          setMsg('')
        }}>Store Message</button></div>
      {wallet !== null && <button onClick={sendTx}>Send Tx</button>}
      <div>

      {hash.length > 0 && <div>Your posted blob tx is <a href={`https://blobscan.com/tx/${hash}`}>{hash}</a></div>}
      </div>
      </div>
  )}