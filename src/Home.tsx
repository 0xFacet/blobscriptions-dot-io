import { Chain, Common, Hardfork } from '@ethereumjs/common'
import { Kzg, initKZG, } from '@ethereumjs/util'
import { createKZG } from 'kzg-wasm'
import { useEffect, useState } from 'react'
import { BIGINT_0, BIGINT_1 } from '@ethereumjs/util'
import Markdown from 'react-markdown'
import { Button } from './components/button'
import { Input } from './components/input'

import { createWalletClient, http, parseGwei, stringToHex, toBlobs } from 'viem';
import { generatePrivateKey } from 'viem/accounts'

import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia } from 'viem/chains';
import FilePickerAndCompressor from "./FilePickerAndCompressor";
import { encode } from 'cbor-x';
import AttachmentsList from './AttachmentsList'

const fakeExponential = (factor: bigint, numerator: bigint, denominator: bigint) => {
  let i = BIGINT_1
  let output = BIGINT_0
  let numerator_accum = factor * denominator
  while (numerator_accum > BIGINT_0) {
    output += numerator_accum
    numerator_accum = (numerator_accum * numerator) / (denominator * i)
    i++
  }

  return output / denominator
}

import { createPublicClient } from 'viem'

const intro = `
Blobscriptions are ethscriptions that store additional data using EIP-4844 blobs. Blobs are much cheaper than calldata which makes them an ideal choice for storing large amounts of data on-chain. [Read the technical details of BlobScriptions here](https://docs.ethscriptions.com/esips/esip-8-ethscription-attachments-aka-blobscriptions).
`

export default function Home() {
  const [kzg, setKzg] = useState<Kzg>()
  const [hash, setHash] = useState<string>('')
  const [compressedData, setCompressedData] = useState(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [blobData, setBlobData] = useState<any>(null);
  const [privateKey, setPrivateKey] = useState<string | null>('')
  const [blockData, setBlockData] = useState<any>(null)
  
  let pkAddress;
  try {
    pkAddress = privateKey ? privateKeyToAccount(privateKey as `0x${string}`).address : undefined;
  } catch (error) {
    pkAddress = undefined;
  }
  
  const [client, setClient] = useState<any>()
  
  const [blobGasPrice, setBlobGasPrice] = useState<bigint>(BIGINT_0)
  const [maxFeePerGas, setMaxFeePerGas] = useState<bigint | undefined>(BIGINT_0)
  const [maxPriorityFeePerGas, setMaxPriorityFeePerGas] = useState<bigint | undefined>(BIGINT_0)
  
  const [ethscriptionInitialOwner, setEthscriptionInitialOwner] = useState<string | null>('')
  
  useEffect(() => {
    const init = async () => {
      const kzg = await createKZG()
      initKZG(kzg, '')
      setKzg(kzg)
    }
    
    init()
  }, [])
  
  useEffect(() => {
    const init = async () => {
      const publicClient = createPublicClient({ 
        chain: import.meta.env.VITE_NETWORK == "mainnet" ? mainnet : sepolia,
        transport: http()
      })
      
      const blockData = await publicClient.getBlock() 
      
      setBlockData(blockData)
      
      const chain = import.meta.env.VITE_NETWORK == "mainnet" ? Chain.Mainnet : Chain.Sepolia
      
      const common = new Common({ chain: chain, hardfork: Hardfork.Cancun , customCrypto: { kzg }})
      
      const est = await publicClient.estimateFeesPerGas()
      
      setMaxFeePerGas(est.maxFeePerGas)
      setMaxPriorityFeePerGas(est.maxPriorityFeePerGas)
      
      const blobGasPrice = fakeExponential(
        common.param('gasPrices', 'minBlobGasPrice'),
        blockData.excessBlobGas,
        common.param('gasConfig', 'blobGasPriceUpdateFraction')
      )
      
      setBlobGasPrice(blobGasPrice)
    }
    
    init()
  }, [])
  
  useEffect(() => {
    const initClient = async () => {
      if (privateKey != null) {
        try {
          // Assuming privateKeyToAccount might throw an error
          const account = privateKeyToAccount(privateKey as `0x${string}`);
          
          const client = createWalletClient({
            account,
            chain: import.meta.env.VITE_NETWORK == "mainnet" ? mainnet : sepolia,
            transport: http(import.meta.env.VITE_SEND_BLOB_RPC),
          });
          setClient(client);
        } catch (error) {
          setClient(null);
        }
      } else {
        setClient(null);
      }
    };
  
    initClient();
  }, [privateKey]);

  const handleCompressedData = (data: any, mimetype: string) => {
    setCompressedData(data);
    setMimeType(mimetype);
  };
  
  useEffect(() => {
    try {
      if (mimeType != null && compressedData != null) {
        const dataObject = {
          contentType: mimeType,
          content: compressedData
        };
        const encodedData = encode(dataObject);
        setBlobData(toBlobs({ data: encodedData }));
      } else {
        setBlobData(null);
      }
    } catch (error) {
      alert("Error encoding blob data: " + error)
      setBlobData(null);
    }
  }, [compressedData, mimeType]);
  
  const [waitingForTxSubmission, setWaitingForTxSubmission] = useState(false)
  
  const loading = waitingForTxSubmission
  
  function blobGas() {
    const calculated = blobGasPrice * 2n
    const floor = parseGwei("10")
    return calculated > floor ? calculated : floor
  }
  
  function maxPriorityFeePerGasCalc() {
    const calculated = maxPriorityFeePerGas! * 2n
    const floor = parseGwei("1")
    return calculated > floor ? calculated : floor
  }
  
  async function doBlob() {
    setHash('')
    
    if (!client || !blobData) {
      console.error('No client or blob data');
      return;
    }
    
    try {
      setWaitingForTxSubmission(true)
      const hash = await client.sendTransaction({
        blobs: blobData,
        kzg,
        data: stringToHex("data:;rule=esip6,"),
        maxPriorityFeePerGas: maxPriorityFeePerGasCalc(),
        maxFeePerGas: maxFeePerGas! * 2n,
        maxFeePerBlobGas: blobGas(),
        to: ethscriptionInitialOwner,
        // nonce: 55 To unstick an transaction send another with the same nonce and higher gas
      });
      setWaitingForTxSubmission(false)
      console.log('Blob Transaction sent successfully!');
      console.log('Transaction hash:', hash);
      setHash(hash);
    } catch (error:any) {
      console.error('Error sending Blob Transaction:', error);
      alert("Error sending Blob Transaction: " + error)
      setHash('');
      setWaitingForTxSubmission(false)
    }
  }
  
  return (
    <div className="flex flex-col gap-4 mt-12">
      <h1 className="text-2xl font-semibold">Welcome to BlobScriptions!</h1>
      <Markdown>{intro}</Markdown>
      <h1 className="text-2xl font-semibold">Create a BlobScription (network: {import.meta.env.VITE_NETWORK})</h1>
      <div className="flex flex-col gap-6">
      <h3 className="text-lg font-semibold">Step 1: Enter a "burner" private key</h3>
      <p className="">It is not currently possible to create BlobScriptions using a wallet like MetaMask. You must use a private key directly. Click the button below to create a fresh wallet. Then send $20 or so to it for gas. Save the private key so you can do multiple BlobScriptions from the same burner.</p>
      <Button
      
      onClick={() => setPrivateKey(generatePrivateKey())}
      className="w-max">Create a burner for me</Button>
      
      <div className="flex flex-col gap-1">
      <Input
        type="text"
        size={74}
        value={privateKey || ''}
        onChange={(e) => setPrivateKey(e.target.value)}
        placeholder="Private key (0x...)"
      ></Input>
      {pkAddress && <p className="text-sm">Your burner address is {pkAddress}</p>}
      </div>
      <h3 className="text-lg font-semibold">Step 2: Enter the BlobScription's initial owner</h3>
      <Input
        type="text"
        size={74}
        value={ethscriptionInitialOwner || ''}
        placeholder="You probably want to put your REAL address here (0x...)"
        onChange={(e) => setEthscriptionInitialOwner(e.target.value)}
      ></Input>
      
      <h3 className="text-lg font-semibold">Step 3: Pick a file</h3>
      <FilePickerAndCompressor onCompress={handleCompressedData} />
      
      { blockData && <Button color="fuchsia" className="w-max mx-auto mt-4" disabled={!!loading || !client || !blobData} onClick={doBlob}>
        Step 4: Create Blobscription
      </Button> }
      
      {hash && <div>
        <h3>Blob tx sent! Once it has been included in a block, your BlobScription will appear in the list below shortly.</h3>
        <p>
          Tx hash: <a href={`${import.meta.env.VITE_ETHERSCAN_BASE_URL}/tx/${hash}`} target={'_blank'}>{hash}</a>
        </p>
      </div>}
      </div>
      <div className="">
        <h3 className="text-2xl font-semibold my-8">Recent BlobScriptions</h3>
        <h3 className="text-2xl font-semibold my-8">
          <a href={`${import.meta.env.VITE_ETHSCRIPTIONS_DOT_COM_BASE_URL}/all?attachment_present=true`} target="_blank">View All on Ethscriptions.com</a>
        </h3>
        
        <AttachmentsList />
      </div>
    </div>
  )}