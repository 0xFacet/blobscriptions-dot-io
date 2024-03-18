import { Block } from '@ethereumjs/block'
import { Chain, Common, Hardfork } from '@ethereumjs/common'
import { BlobEIP4844Transaction, FeeMarketEIP1559Transaction } from '@ethereumjs/tx'
import { Kzg, SECP256K1_ORDER_DIV_2, bytesToBigInt, bytesToHex, bytesToUtf8, hexToBytes, initKZG, randomBytes } from '@ethereumjs/util'
import { createKZG } from 'kzg-wasm'
import { useEffect, useState } from 'react'
import { BIGINT_0, BIGINT_1 } from '@ethereumjs/util'


import { createWalletClient, http, parseGwei, stringToHex, toBlobs } from 'viem';
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

export default function ConnectButton() {
  const [kzg, setKzg] = useState<Kzg>()
  const [hash, setHash] = useState<string>('')
  const [compressedData, setCompressedData] = useState(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [cborData, setCborData] = useState<Uint8Array | null>(null);
  const [blobData, setBlobData] = useState<any>(null);
  const [privateKey, setPrivateKey] = useState<string | null>('')
  
  const [account, setAccount] = useState<any>()
  const [client, setClient] = useState<any>()
  
  const [blobGasPrice, setBlobGasPrice] = useState<bigint>(BIGINT_0)
  const [maxFeePerGas, setMaxFeePerGas] = useState<bigint | undefined>(BIGINT_0)
  const [maxPriorityFeePerGas, setMaxPriorityFeePerGas] = useState<bigint | undefined>(BIGINT_0)
  
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
  
  async function doBlob() {
    if (!client || !blobData) {
      console.error('No client or blob data');
      return;
    }
    try {
      const hash = await client.sendTransaction({
        blobs: blobData,
        kzg,
        data: stringToHex("data:;rule=esip6,blob"),
        maxPriorityFeePerGas: maxPriorityFeePerGas!* 150n / 100n,
        // maxPriorityFeePerGas: parseGwei('10'),
        maxFeePerGas: maxFeePerGas! * 150n / 100n,
        // maxFeePerGas: parseGwei('10000'),
        maxFeePerBlobGas: blobGasPrice * 5n,
        // maxFeePerBlobGas: parseGwei('10000'),
        to: '0x0000000000000000000000000000000000000000',
      });
  
      console.log('Blob Transaction sent successfully!');
      console.log('Transaction hash:', hash);
      setHash(hash);
    } catch (error) {
      console.error('Error sending Blob Transaction:', error);
      setHash('');
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Create a Blobscription!</h1>
      <div className="flex flex-col gap-6">
      <h3>Step 1: Enter private key</h3>
      <input
        type="text"
        size={74}
        value={privateKey || ''}
        onChange={(e) => setPrivateKey(e.target.value)}
      ></input>
      
      <h3>Step 2: Pick a file</h3>
      <FilePickerAndCompressor onCompress={handleCompressedData} />
      
      <button className="w-max mx-auto" onClick={doBlob}>Step 3: Create Blobscription</button>
      
      {hash && <div>
        <h3>Blob tx sent successfully!</h3>
        <p>
          Tx hash: <a href={`https://sepolia.etherscan.io/tx/${hash}`} target={'_blank'}>{hash}</a>
        </p>
      </div>}
      </div>
      <div>
        <h3 className="font-semibold text-lg">Existing Blobscriptions</h3>
        <AttachmentsList />
      </div>
    </div>
  )}