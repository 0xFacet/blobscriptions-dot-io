import { Block } from '@ethereumjs/block'
import { Chain, Common, Hardfork } from '@ethereumjs/common'
import { BlobEIP4844Transaction, FeeMarketEIP1559Transaction } from '@ethereumjs/tx'
import { Kzg, SECP256K1_ORDER_DIV_2, bytesToBigInt, bytesToHex, bytesToUtf8, hexToBytes, initKZG, randomBytes } from '@ethereumjs/util'
import { createKZG } from 'kzg-wasm'
import { useEffect, useState } from 'react'
import { BIGINT_0, BIGINT_1 } from '@ethereumjs/util'
import Markdown from 'react-markdown'
import { Button } from './components/button'
import { Input } from './components/input'
import { Textarea } from './components/textarea'


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

const faq = `

**But I thought blobs disappeared after 18 days!**

While the Ethereum protocol does not guarantee blob data availability beyond 18 days, because so much important data is stored in blobs there will be significant demand outside of ethscriptions for long-term availability solutions. Like IPFS, as long as one copy of the blob data exists, it can be verified and used by anyone, ensuring transparency and auditability.

`

export default function ConnectButton() {
  const [showFaq, setShowFaq] = useState(false)
  
  const [kzg, setKzg] = useState<Kzg>()
  const [hash, setHash] = useState<string>('')
  const [compressedData, setCompressedData] = useState(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [cborData, setCborData] = useState<Uint8Array | null>(null);
  const [blobData, setBlobData] = useState<any>(null);
  const [privateKey, setPrivateKey] = useState<string | null>('')
  const pkAddress = privateKey && privateKeyToAccount(privateKey as `0x${string}`).address
  
  const [publicClient, setPublicClient] = useState<any>(null)
  
  const [account, setAccount] = useState<any>(null)
  const [client, setClient] = useState<any>()
  
  const [calldataText, setCalldataText] = useState<string>("")
  
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
        chain: sepolia,
        transport: http()
      })
      
      const blockData = await publicClient.getBlock() 
      
      const common = new Common({ chain: Chain.Sepolia, hardfork: Hardfork.Cancun , customCrypto: { kzg }})
      
      const est = await publicClient.estimateFeesPerGas()
      
      setMaxFeePerGas(est.maxFeePerGas)
      setMaxPriorityFeePerGas(est.maxPriorityFeePerGas)
      
      const blobGasPrice = fakeExponential(
        common.param('gasPrices', 'minBlobGasPrice'),
        blockData.excessBlobGas,
        common.param('gasConfig', 'blobGasPriceUpdateFraction')
      )
      
      setBlobGasPrice(blobGasPrice)
      
      setPublicClient(publicClient)
    }
    init()

  }, [])
  
  useEffect(() => {
    const initClient = async () => {
      if (privateKey != null) {
        try {
          // Assuming privateKeyToAccount might throw an error
          const account = privateKeyToAccount(privateKey as `0x${string}`);
          setAccount(account);
          
          const client = createWalletClient({
            account,
            // chain: mainnet,
            chain: sepolia,
            // transport: http("https://ethereum-rpc.publicnode.com"),
            transport: http("https://eth-sepolia.g.alchemy.com/v2/w9VBEKVyORWDZIHaf8BkrfDNRs92V2jc"),
            // transport: http("https://eth-mainnet.g.alchemy.com/v2/w9VBEKVyORWDZIHaf8BkrfDNRs92V2jc"),
          });
          setClient(client);
        } catch (error) {
          // Handle the error, e.g., by resetting state or showing an error message
          setAccount(null);
          setClient(null);
          // Optionally, set an error state to show the error in the UI
        }
      } else {
        setAccount(null);
        setClient(null);
      }
    };
  
    initClient();
  }, [privateKey]); // Dependency array, re-run this effect when privateKey changes

  const handleCompressedData = (data: any, mimetype: string) => {
    setCompressedData(data);
    setMimeType(mimetype);
  };
  
  useEffect(() => {
    console.log(compressedData, mimeType)
    
    if (mimeType != null && compressedData != null) {
      const dataObject = {
        mimetype: mimeType,
        content: compressedData
      };
      const encodedData = encode(dataObject);
      setCborData(encodedData);
      setBlobData(toBlobs({ data: encodedData }));
    } else {
      setCborData(null);
      setBlobData(null);
    }
  }, [compressedData, mimeType]);
  
  const [waitingForTxSubmission, setWaitingForTxSubmission] = useState(false)
  
  const loading = waitingForTxSubmission
  
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
        data: stringToHex("data:;rule=esip6," + calldataText),
        maxPriorityFeePerGas: maxPriorityFeePerGas!* 150n / 100n,
        // maxPriorityFeePerGas: parseGwei('10'),
        maxFeePerGas: maxFeePerGas! * 150n / 100n,
        // maxFeePerGas: parseGwei('10000'),
        maxFeePerBlobGas: blobGasPrice * 5n,
        // maxFeePerBlobGas: parseGwei('10000'),
        to: ethscriptionInitialOwner,
      });
      setWaitingForTxSubmission(false)
      console.log('Blob Transaction sent successfully!');
      console.log('Transaction hash:', hash);
      setHash(hash);
    } catch (error) {
      console.error('Error sending Blob Transaction:', error);
      setHash('');
      setWaitingForTxSubmission(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 mt-12">
      <h1 className="text-2xl font-semibold">Welcome to BlobScriptions!</h1>
      <Markdown>{intro}</Markdown>
      <Button className="w-max" onClick={() => setShowFaq(i => !i)}>{showFaq ? 'Hide' : 'Show'} FAQ</Button>
      {showFaq && <div>
        <Markdown>{faq}</Markdown>
      </div>}
      <h1 className="text-2xl font-semibold">Create a BlobScription</h1>
      <div className="flex flex-col gap-6">
      <h3 className="text-lg font-semibold">Step 1: Enter a "burner" private key</h3>
      <p className="">It is not currently possible to create BlobScriptions using a wallet like MetaMask. You must use a private key directly. Create a fresh wallet and send $20 or so to it for gas. Click the button below to do it automatically. Save the private key so you can do multiple BlobScriptions from the same burner.</p>
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
        // className="p-2 rounded-md border border-gray-500 focus:outline-none"
      ></Input>
      {pkAddress && <p className="text-sm">Your burner address is {pkAddress}</p>}
      </div>
      <h3 className="text-lg font-semibold">Step 2: Enter the BlobScription's initial owner</h3>
      <Input
        type="text"
        size={74}
        value={ethscriptionInitialOwner || ''}
        placeholder="Recipient address (0x...)"
        onChange={(e) => setEthscriptionInitialOwner(e.target.value)}
        // className="p-2 rounded-md border border-gray-500 focus:outline-none"
      ></Input>
      
      {/* <h4 className="font-semibold">Optional: Enter a message for the calldata</h4>
      
      <Textarea
      value={calldataText}
      onChange={(e) => setCalldataText(e.target.value)}
      // className="p-2 rounded-md border border-gray-500 focus:outline-none w-1/2"

      >
        
      </Textarea> */}
      
      <h3 className="text-lg font-semibold">Step 3: Pick a file</h3>
      <FilePickerAndCompressor onCompress={handleCompressedData} />
      
      <Button color="fuchsia" className="w-max mx-auto mt-4" disabled={!!loading || !client || !blobData} onClick={doBlob}>Step 4: Create Blobscription</Button>
      
      {hash && <div>
        <h3>Blob tx sent! Once it has been included in a block, your BlobScription will appear in the list below shortly.</h3>
        <p>
          Tx hash: <a href={`https://sepolia.etherscan.io/tx/${hash}`} target={'_blank'}>{hash}</a>
        </p>
      </div>}
      </div>
      <div className="">
        <h3 className="text-2xl font-semibold my-8">Existing Blobscriptions</h3>
        <AttachmentsList />
      </div>
    </div>
  )}