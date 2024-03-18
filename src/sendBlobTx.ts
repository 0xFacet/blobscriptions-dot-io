// 1) `npm install viem c-kzg` first
// 2) Fill in your private key and ethscription data URI
// 3) Create file sendBlobTx.ts and paste this in
// 3) Run `node sendBlobTx.ts` to send a blob transaction

const { promisify } = require('util')

const { createWalletClient, http, parseGwei, stringToHex, sha256 } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { mainnet, sepolia } = require('viem/chains');
const cKzg = require('c-kzg');
const { setupKzg } = require('viem');


const mainnetTrustedSetupPath = './node_modules/viem/trusted-setups/mainnet.json'

const { toBlobs } = require('viem');
const fs = require('fs');
const cbor = require('cbor');

const imagePath = '/Users/tom/Dropbox/downloads-dropbox/_Users_tom_Dropbox%20(Personal)_downloads-dropbox_c90b09214261e7ca8bd11facfc46603a%20(1).svg.png'
const imageData = fs.readFileSync(imagePath);


async function createGzippedBlobs() {
  try {
    const gzippedCborData = imageData// await gzip(imageData); // Gzip the CBOR data
    const dataObject = {
      mimetype: 'image/png',
      content: gzippedCborData
      // content: "Hello from a BLOB!"
    };
    const cborData = cbor.encode(dataObject)
    
    return toBlobs({ data: cborData }); // Convert gzipped data to blobs

    // console.log(blobs);
  } catch (error) {
    console.error('Error gzipping data:', error);
  }
}

// const cborData = cbor.encode(dataObject);
// const blobs = toBlobs({ data: cborData });



const privateKey = ''


// function generateEthscriptionDataURI(input) {
//   let hash
//   let length
//   let contentType = 'text/plain'; // Default content type

//   if (Buffer.isBuffer(input)) {
//     // Input is a Buffer (binary data)
//     hash = sha256(input)
//     length = input.length; // Directly use Buffer's length property for binary data
//     contentType = 'image/jpeg'; // Set content type to PNG for binary data

//   } else {
//     // Input is a string (text data)
//     hash = sha256(input)
//     length = Buffer.byteLength(input, 'utf8'); // Calculate byte length for text
//   }

//   // Construct the ethscriptionDataURI with dynamic values
//   const ethscriptionDataURI = `data:application/vnd.esc.attachment+json;rule=esip6,{"sha256":"${hash}","length":${length},"type":"${contentType}"}`;

//   return ethscriptionDataURI;
// }

// const imagePath = '/Users/tom/Dropbox/downloads-dropbox/canard-lapin-retouche-63fc30-1024-3.png'; // Update this path to your PNG file
// const imagePath = '/Users/tom/Dropbox/downloads-dropbox/wait-what-summer.png'; // Update this path to your PNG file
// const imagePath = '/Users/tom/Dropbox/downloads-dropbox/Voyager_golden_record_82_feeding-medium.png'
// const base64Data = blobData.toString('base64');
// const blobDataURI = `data:image/png;base64,${base64Data}`;
// const ethscriptionDataURI = "data:,hello from Ethscription calldata!"
const ethscriptionDataURI = "data:;rule=esip6,hello from Ethscription calldata!"
// const ethscriptionDataURI = generateEthscriptionDataURI(blobData)



// const imagePath = '/Users/tom/Dropbox/downloads-dropbox/starroom.gif'


// const ethscriptionDataURI = generateEthscriptionDataURI(blobData)

console.log(ethscriptionDataURI)

// fs.writeFileSync("./hex",  "0x" + cborData.toString('hex'))
// console.log(cborData.toString('hex'))
// exit(1)

async function main() {
  const blobs = await createGzippedBlobs()
  
  // console.log(blobDataURI.slice(-100))
  // // console.log(stringToHex(blobDataURI).slice(-100))
  
  // console.log(toBlobs({ data: "00000000000000000000000000000000000000000000000000000000000099" }))
  // return
  // // console.log(toBlobs({ data: "0x00000000000000000000000000000000000000000000000000000000998000" }))
  // console.log(toBlobs({ data: "0x0000000000000000000000000000000000000000000000000000000099" }))
  
  // // console.log(
  // //   toBlobs({ data: "0x000000000000000000000000000000000000000000000000000000998000" })[0] == toBlobs({ data: "0x0000000000000000000000000000000000000000000000000000000099" })[0]
  // // )
  
  // return
  
  
  const account = privateKeyToAccount(privateKey);
  
  const client = createWalletClient({
    account,
    chain: mainnet,
    // chain: sepolia,
    // transport: http("https://ethereum-rpc.publicnode.com"),
    // transport: http("https://eth-sepolia.g.alchemy.com/v2/w9VBEKVyORWDZIHaf8BkrfDNRs92V2jc"),
    transport: http("https://eth-mainnet.g.alchemy.com/v2/w9VBEKVyORWDZIHaf8BkrfDNRs92V2jc"),
  });
  
  const kzg = setupKzg(cKzg, mainnetTrustedSetupPath);
  // console.log(kzg.blobToKzgCommitment())
  // exit(1)
// console.log(stringToHex(blobData))
// return
  // const blobs = toBlobs({ data: stringToHex(blobDataURI) });
  // const blobs = toBlobs({ data: cborData });
  
  try {
    const hash = await client.sendTransaction({
      blobs,
      kzg,
      data: stringToHex(ethscriptionDataURI),
      maxFeePerBlobGas: parseGwei('30'),
      to: '0x0000000000000000000000000000000000000000',
    });

    console.log('Blob Transaction sent successfully!');
    console.log('Transaction hash:', hash);
  } catch (error) {
    console.error('Error sending Blob Transaction:', error);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});