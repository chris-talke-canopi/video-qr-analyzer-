require('dotenv').config()

const fs = require('fs');
const { BlobServiceClient, StorageSharedKeyCredential } = require("@azure/storage-blob");
const express = require('express');
const ffmpeg = require('ffmpeg');
const { Image } = require('image-js');
const jsQR = require('jsqr');

const account = process.env.AZR_BUCKET_NAME;
const accountKey = process.env.AZR_BUCKET_KEY;
const containerName = process.env.AZR_CONTAINER_NAME;

const app = express();
const port = 1356;

app.get('/review', async (req, res) => {
  const { email_address, filename } = req.query;

  if (!email_address && !filename) {
    console.log(`[SERVER] Rejecting request, missing paramaters.`)
    return res.send('Just no.')
  }

  // Create Temp Dir
  console.log(`[SERVER] Recieved job for '${email_address}' to review video.`)
  const filename_noext = filename.split('.')[0];
  const localFilePath = `${__dirname}/tmp/${filename}`;
  if (!fs.existsSync(localFilePath)) {
    fs.mkdirSync(localFilePath);
  }
  console.log(`[SERVER] Filepath '${localFilePath}' available for read/write.`)

  // Gets Video From Storage
  console.log(`[SERVER] Downloading video: '${filename}'.`)
  const sharedKeyCredential = await new StorageSharedKeyCredential(account, accountKey);
  const blobServiceClient = await new BlobServiceClient(`https://${account}.blob.core.windows.net`, sharedKeyCredential);
  const containerClient = await blobServiceClient.getContainerClient(containerName);
  const blobClient = await containerClient.getBlobClient(filename);
  await blobClient.downloadToFile(`${localFilePath}/${filename}`);


  // Dump frames from video
  console.log(`[SERVER] Dumping frames for video: '${filename}'.`)
  const inputVideo = `${localFilePath}/${filename}`;
  const outputDirectory = `${localFilePath}/`;
  const video = await ffmpeg(inputVideo);
  await video.fnExtractFrameToJPG(outputDirectory, {
      file_name: `${filename_noext}_%t_%s`,
      every_n_seconds: 1,
  });

  // Review dumped frames for a QR Code
  const images = fs.readdirSync(localFilePath).filter(f => f.includes('.jpg') && f.includes(filename_noext));
  console.log(`[SERVER] Found '${images.length}' images...`);
  let results = [];
  for (let i = 0; i < images.length; i++) {
      console.log(`[SERVER]   Reading Image '${i + 1}' out of '${images.length}'.`);
      
      const image = images[i];
      const image_path = `${localFilePath}/${image}`;
      const result = await readQRCode(image_path);
      if (result) {
        if (result.data.includes('bexQde')) {
            console.log(`[SERVER]      Found QR Code in file '${image}', exiting early!`)
            results.push(result);
            i = images.length;
        }
      }
  }

  // Clean up data
  console.log(`[SERVER] Cleaning up temporary directory and files.`)
  fs.rmSync(localFilePath, { recursive: true, force: true });
  await blobClient.deleteIfExists({ deleteSnapshots: 'include' });


  // Return Result > Success
  if (results.length > 0) {
    console.log(`[SERVER] QR Code found, sending success message.`)
    return res.send('success')
  }


  // Return Result > Failed
  console.log(`[SERVER] No QR Code found, sending failed message.`)
  return res.send('failed');
});

app.all('*', (req, res) => {
  return res.send('🤠 ya lost partna?');
});

app.listen(port, () => {
  console.log(`[SERVER] Listening on Port: '${port}'`)
});

async function readQRCode(imagePath) {
  try {
      const image = await Image.load(imagePath);
      const imageData = image.getPixelsArray();

      const { data, width, height } = image;
      const qrCode = jsQR(data, width, height);

      if (qrCode) {
          return qrCode;
      } else {
          return null;
      }
  } catch (error) {
      console.error('Error reading QR Code:', error.message);
  }
}