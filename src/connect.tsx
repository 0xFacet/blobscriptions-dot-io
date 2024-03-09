import { Chain, Common, Hardfork } from '@ethereumjs/common'
import { BlobEIP4844Transaction } from '@ethereumjs/tx'
import { Address, Kzg, bytesToHex, fromRpcSig, initKZG, randomBytes } from '@ethereumjs/util'
import { useConnectWallet } from '@web3-onboard/react'
import { createKZG } from 'kzg-wasm'
import { useEffect, useState } from 'react'

export default function ConnectButton() {
  const [tx, setTx] = useState<BlobEIP4844Transaction>()
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
    const nonce = await wallet!.provider.request({
      "method":'eth_getTransactionCount',
      "params":[wallet?.accounts[0].address]
    }) as string
    console.log(nonce)
    const common = new Common({ chain: Chain.Sepolia, hardfork: Hardfork.Cancun , customCrypto: { kzg }})
    const tx = BlobEIP4844Transaction.fromTxData({ nonce: parseInt(nonce), blobsData: ['hello world'], to: '0xff00000000000000000000000000000000074248', gasLimit: 0x5208, maxFeePerGas: parseInt(tip.baseFeePerGas[0] + 5), maxFeePerBlobGas: 0xf, maxPriorityFeePerGas: parseInt(tip.reward[0])}, { common })
    setTx(tx)
    const res = await wallet!.provider.request({
      "method": "eth_sign",
      "params": [wallet?.accounts[0].address,bytesToHex(tx?.getHashedMessageToSign())]
    }) as string
    console.log(res)
    const { v, r, s } = fromRpcSig(res)
    
    const signedTx = tx?.addSignature(v, r, s,true)
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