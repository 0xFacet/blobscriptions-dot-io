import { Chain, Common, Hardfork } from '@ethereumjs/common'
import { BlobEIP4844Transaction, FeeMarketEIP1559Transaction } from '@ethereumjs/tx'
import { Kzg, SECP256K1_ORDER_DIV_2, bytesToBigInt, bytesToHex, initKZG, randomBytes } from '@ethereumjs/util'
import { useConnectWallet } from '@web3-onboard/react'
import { createKZG } from 'kzg-wasm'
import { useEffect, useState } from 'react'

export default function ConnectButton() {
  const [kzg, setKzg] = useState<Kzg>()
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
    console.log('tip', tip)
    const common = new Common({ chain: Chain.Holesky, hardfork: Hardfork.Cancun , customCrypto: { kzg }})
    const blobTx = BlobEIP4844Transaction.fromTxData({ nonce: 0x0, blobsData: ['hello from browser'], to: '0xff00000000000000000000000000000000074248', gasLimit: 0x5208, maxFeePerGas: parseInt(tip.baseFeePerGas[0] + 5), maxFeePerBlobGas: 0xffff, maxPriorityFeePerGas: parseInt(tip.reward[0])}, { common })

    const r = randomBytes(32)
    let s = randomBytes(32)
    while (bytesToBigInt(s) > SECP256K1_ORDER_DIV_2) {
      s = randomBytes(32)
    }
    const v = 0n
    let signedTx 
    let done = false
    while (!done) {
        signedTx = blobTx?.addSignature(v, r, s)
        done = signedTx.verifySignature()
        console.log('tx is valid', done)
    }
    const upFrontCost = blobTx.getUpfrontCost(BigInt(tip.baseFeePerGas[1])) * 1000n
    const maxFee = parseInt(tip.baseFeePerGas[1]) > parseInt(tip.reward[0]) ? parseInt(tip.baseFeePerGas[1]) : parseInt(tip.reward[0])
    const nonce = await wallet!.provider.request({
      "method": "eth_getTransactionCount",
      "params": [wallet?.accounts[0].address ]
    }) as string
    const tx = FeeMarketEIP1559Transaction.fromTxData({ nonce: parseInt(nonce), to: signedTx.getSenderAddress(), value: upFrontCost, gasLimit: 0x5208, maxFeePerGas: maxFee, maxPriorityFeePerGas: parseInt(tip.reward[0]) })
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
    const res2 = await wallet!.provider.request({
      "method": "eth_sendRawTransaction",
      "params": [bytesToHex(signedTx!.serializeNetworkWrapper())]
    })
    console.log(res2)

  }

  return (
    <div>
     {wallet === null && <button
        disabled={connecting}
        onClick={() => connect()}>
        Connect
      </button>}
      {wallet !== null && wallet.provider && <button onClick={() => disconnect(wallet)}>Disconnect</button>}
      {wallet !== null && <button onClick={sendTx}>Send Tx</button>}
    </div>
  )}