import { Chain, Common, Hardfork } from '@ethereumjs/common'
import { BlobEIP4844Transaction } from '@ethereumjs/tx'
import { Address, bytesToHex, ecrecover, fromRpcSig, initKZG, randomBytes } from '@ethereumjs/util'
import { useConnectWallet } from '@web3-onboard/react'
import { createKZG } from 'kzg-wasm'
import { useEffect, useState } from 'react'

export default function ConnectButton() {
  const [tx, setTx] = useState<BlobEIP4844Transaction>()
  useEffect(() => {
    const init = async () => {
      const kzg = await createKZG()
      initKZG(kzg, '')
      const common = new Common({ chain: Chain.Goerli, hardfork: Hardfork.Cancun , customCrypto: { kzg }})
      const tx = BlobEIP4844Transaction.fromTxData({ blobsData: ['hello world'], to: Address.fromPrivateKey(randomBytes(32)), gasLimit: 0xffffff, maxFeePerGas: 0xffff, maxFeePerBlobGas: 0xf, maxPriorityFeePerGas: 0xf }, { common })
      setTx(tx)
    }
    init()
  }, [])
  const [{ wallet, connecting }, connect, disconnect] = useConnectWallet()
  const sendTx = async () => {
    console.log(wallet!.accounts[0].balance)
    const res = await wallet!.provider.request({
      "method": "personal_sign",
      "params": [wallet?.accounts[0].address, bytesToHex(tx!.getHashedMessageToSign())]
    }) as string
    const { v, r, s } = fromRpcSig(res)
    
    const signedTx = tx?.addSignature(v, r, s, true)
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