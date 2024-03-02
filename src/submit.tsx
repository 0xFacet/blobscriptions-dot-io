import { BlobEIP4844Transaction } from "@ethereumjs/tx";
import { bytesToHex } from "@ethereumjs/util";
import { useWallets } from '@web3-onboard/react'
export default function SubmitTx(tx: BlobEIP4844Transaction) {
  const wallets = useWallets()
  console.log(tx)
  return (
    <div>
      <button onClick={() => wallets[0].provider.request({method: 'sendRawTransaction', params: [bytesToHex(tx.serialize())]})}>Send Tx</button>
    </div>
  )
}