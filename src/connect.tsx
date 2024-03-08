import { Chain, Common, Hardfork } from '@ethereumjs/common'
import { BlobEIP4844Transaction } from '@ethereumjs/tx'
import { Address, bytesToHex, fromRpcSig, initKZG, randomBytes } from '@ethereumjs/util'
import { useConnectWallet } from '@web3-onboard/react'
import { createKZG } from 'kzg-wasm'
import { useEffect, useState } from 'react'

export default function ConnectButton() {
  const [tx, setTx] = useState<BlobEIP4844Transaction>()
  useEffect(() => {
    const init = async () => {
      const kzg = await createKZG()
      initKZG(kzg, '')
      const common = new Common({ chain: Chain.Sepolia, hardfork: Hardfork.Cancun , customCrypto: { kzg }})
      const tx = BlobEIP4844Transaction.fromTxData({ nonce: 1n, blobsData: ['hello world'], to: '0xff00000000000000000000000000000000074248', gasLimit: 0xffffff, maxFeePerGas: 0xffffffff, maxFeePerBlobGas: 0xfffff, maxPriorityFeePerGas: 0xfffff }, { common })
      setTx(tx)
    }
    init()
  }, [])
  const [{ wallet, connecting }, connect, disconnect] = useConnectWallet()
  const sendTx = async () => {
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
     {wallet === null  && <button
        disabled={connecting}
        onClick={() => connect()}>
        Connect
      </button>}
      {wallet !== null && wallet.provider && <button onClick={() => disconnect(wallet)}>Disconnect</button>}
      {wallet !== null && tx !== undefined &&   <button onClick={sendTx}>Send Tx</button>}
    </div>
  )
}