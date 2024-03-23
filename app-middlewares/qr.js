const express = require('express');
const router = express.Router();
const QRCode = require('qrcode-svg');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

function generateVCard(fields) {
    let vCardString = 'BEGIN:VCARD\nVERSION:3.0\n';

    for (const [key, value] of Object.entries(fields)) {
        if (value) {
            vCardString += `${key}:${value}\n`;
        }
    }

    vCardString += 'END:VCARD';
    return vCardString;
}

router.get('/list', async(req,res)=>{
    // Array to hold the objects
let rooms = [];

// List of room strings
let roomList = [
    "H1_R107_G",	"H1_R206_U",
    "H1_R110_G",	"H1_R209_U",
    "H1_R113_G",	"H1_R212_U",
    "H1_R116_G",	"H1_R215_U"

];

// Iterate over each room string and create an object
roomList.forEach(roomString => {
    let parts = roomString.split('_');
    let hostel = parts[0];
    let roomNumber = parts[1];
    let floor = parts[2];
    let availableBeds = 4; // You may want to specify this value
    let reservation = "Alumni";
    
    // Push the object into the array
    rooms.push({
        "hostel": hostel,
        "roomNumber": roomNumber,
        "floor": floor,
        "availableBeds": availableBeds,
        "reservation": reservation
    });
});

// Print the array
console.log(rooms);

console.log(rooms.length)
res.end()

})

router.get('/init-qr', async (req, res) => {
    const csvFilePath = path.join(__dirname, 'names.csv');
    const logoPath = path.join(__dirname, 'pcmmis.png');
    const logoData = fs.readFileSync(logoPath, 'base64');

    fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
            const fields = {
                FN: row['Name'],
                N:  row['Name'] + ';;;',
                ORG: row['Organization'],
                TITLE: row['Title'],
                TEL: row['Phone'],
                EMAIL: row['Email'],
                NOTE: row['Note'],
                ROOM: row['Room']
            };

            const vCardData = generateVCard(fields);
            const qr = new QRCode(vCardData);
            const svgString = qr.svg();

            // Calculate the position to center the image
            const qrSize = 200; // Change this to the actual size of your QR code
            const imageSize = 50; // Change this to the size of your image
            const xPos = (qrSize - imageSize) / 2;
            const yPos = (qrSize - imageSize) / 2;

            // Define a circular clip path
            const clipPathId = `clip-path-${row['Organization']}-${row['Name']}`;
            const clipPath = `<clipPath id="${clipPathId}">
                <circle cx="${xPos + imageSize / 2}" cy="${yPos + imageSize / 2}" r="${imageSize / 2}" />
            </clipPath>`;

            // Insert the clip path and image into the SVG
            const logoSvg = `<defs>${clipPath}</defs><image x="40%" y="40%" width="${imageSize}" height="${imageSize}" clip-path="url(#${clipPathId})" xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="data:image/png;base64,${logoData}" />`;
            const modifiedSvgString = svgString.replace('</svg>', `${logoSvg}</svg>`);

            fs.writeFileSync(`pcmVcards/${row['Title']}/${row['Organization']}_${row['Name']}.svg`, modifiedSvgString, 'utf-8');

            console.log(`QR code for ${row['Name']} saved as ${row['Organization']}_${row['Name']}.svg`);
        })
        .on('end', () => {
            console.log('CSV file successfully processed');
        });

    res.end();
});

module.exports = router;
