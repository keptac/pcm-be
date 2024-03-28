const express = require('express');
const connection = require('../helpers/connection');
const query = require('../helpers/query');
const router = express.Router();
const dbConfig = require('../dbConfig');
const { emit } = require('process');
const logging = require('../helpers/logging');
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');


const csvFilePath = path.join(__dirname, 'attendees_db.csv');

const mongoURL = 'mongodb+srv://zeucpcmadmin:p%4055w0rd@zeucpcm.ysiholk.mongodb.net/?retryWrites=true&w=majority&appName=zeucpcm';

const mongoClient = new MongoClient(mongoURL, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  maxPoolSize: 50, // Adjust as per your requirements
  wtimeoutMS: 2500,
});


router.post('/checkin', async (req, res) => {

  const sender = req.body.phoneNumber;

  console.log("received checkin in request for  "+ sender);

  try {
    await mongoClient.connect();
    const db = mongoClient.db('pcmmiscon'); 

    const usersCollection = db.collection('users');
    let user = await usersCollection.findOne({ _id: sender });

    if (!user) {

      //First time user being checkedin
      const columnName = 'Phone'; 
      const searchValue = sender.substring(sender.length - 9);
      let registeredUser;
  
      try {
          const results = await new Promise((resolve, reject) => {

            console.log("finding attendeee"+ csvFilePath+":"+searchValue)
              searchRow(csvFilePath, columnName, searchValue, (error, results) => {
                  if (error) {
                      console.error('Error Occurred:', error);
                      reject(error);
                  } else {
                      console.log("Sender request result: "+ results);
                      resolve(results);
                  }
              });
          });
  
          if (results.length === 0) {
              console.log("Sender registration not found: "+ sender);
              res.status(200).send({
                'success': false,
                'message': 'Did not find user registration.',
                'responseBody': {
                  'message': 'Did not find user registration.'
                }
              });
              res.end();

          } else {
              console.log("Found registered user:", results[0]);
              registeredUser = results[0];

              await usersCollection.insertOne({
                _id: sender, 
                username: registeredUser.Name, 
                gender:registeredUser.Gender,
                title: registeredUser.Title,
                email: registeredUser.Email,
                sessions: registeredUser.Note,
                institute: registeredUser.Organization,
                registrationStatus: 'REGISTERED',
                bookingStatus:"", 
                selectedRoom: "",
                checkinStatus: 'CHECKED IN'
            });

            res.status(200).send({
              'success': true,
              'message': registeredUser.Name+' checkin in successful.',
              'responseBody': {
                'message': registeredUser.Name+' checkin in successful. Room number '+registeredUser.Room,
              }
            });
            res.end();
          }
  
  
      } catch (error) {
          console.error('Error occurred during search:', error);
          res.status(500).send({
            'success': false,
            'message': 'Apologies. Something went wrong. Please refresh and try again.',
            'responseBody': {
              'message': 'Apologies. Something went wrong. Please refresh and try again.',
            }
          });
          res.end();
        }
  }
  else{
    try {
        await usersCollection.updateOne({ _id: sender }, { $set: {  checkinStatus: 'CHECKED IN' } });

        res.status(200).send({
          'success': true,
          'message': user.username+' checkin in successful.',
          'responseBody': {
            'message': user.username+' checkin in successful. Room number '+ user.selectedRoom,
          }
        });
        res.end();

      } catch (error) {
        console.error('Error occurred during search:', error);
        res.status(500).send({
          'success': false,
          'message': 'Apologies. Something went wrong. Please refresh and try again.',
          'responseBody': {
            'message': 'Apologies. Something went wrong. Please refresh and try again.',
          }
        });
        res.end();
      }
    }
  } catch (error) {
    console.error('Error:', error);
    console.error('Error occurred during search:', error);
          res.status(500).send({
            'success': false,
            'message': 'Apologies. Something went wrong. Please refresh and try again.',
            'responseBody': {
              'message': 'Apologies. Something went wrong. Please refresh and try again.',
            }
          });
          res.end();
  } finally {
    await mongoClient.close();
  }

});



router.post('/meals', async (req, res) => {

  const sender = req.body.phoneNumber;

  console.log("received checkin in request for  "+ sender);

  try {
    await mongoClient.connect();
    const db = mongoClient.db('pcmmiscon'); 

    const usersCollection = db.collection('users');
    let user = await usersCollection.findOne({ _id: sender });

    if (!user) {

      //First time user being checkedin
      const columnName = 'Phone'; 
      const searchValue = sender.substring(sender.length - 9);
      let registeredUser;
  
      try {
          const results = await new Promise((resolve, reject) => {

            console.log("finding attendeee"+ csvFilePath+":"+searchValue)
              searchRow(csvFilePath, columnName, searchValue, (error, results) => {
                  if (error) {
                      console.error('Error Occurred:', error);
                      reject(error);
                  } else {
                      console.log("Sender request result: "+ results);
                      resolve(results);
                  }
              });
          });
  
          if (results.length === 0) {
              console.log("Sender registration not found: "+ sender);
              res.status(200).send({
                'success': false,
                'message': 'Did not find user registration.',
                'responseBody': {
                  'message': 'Did not find user registration.'
                }
              });
              res.end();

          } else {
              console.log("Found registered user:", results[0]);
              registeredUser = results[0];

              await usersCollection.insertOne({
                _id: sender, 
                username: registeredUser.Name, 
                gender:registeredUser.Gender,
                title: registeredUser.Title,
                email: registeredUser.Email,
                sessions: registeredUser.Note,
                institute: registeredUser.Organization,
                registrationStatus: 'REGISTERED',
                bookingStatus: 'BOOKED', 
                selectedRoom: registeredUser.Room,
                checkinStatus: 'CHECKED IN'
            });

            res.status(200).send({
              'success': true,
              'message': registeredUser.Name+' checkin in successful.',
              'responseBody': {
                'message': registeredUser.Name+' checkin in successful. Room number '+registeredUser.Room,
              }
            });
            res.end();
          }
  
  
      } catch (error) {
          console.error('Error occurred during search:', error);
          res.status(500).send({
            'success': false,
            'message': 'Apologies. Something went wrong. Please refresh and try again.',
            'responseBody': {
              'message': 'Apologies. Something went wrong. Please refresh and try again.',
            }
          });
          res.end();
        }
  }
  else{
    try {
        await usersCollection.updateOne({ _id: sender }, { $set: {  checkinStatus: 'CHECKED IN' } });

        res.status(200).send({
          'success': true,
          'message': user.username+' checkin in successful.',
          'responseBody': {
            'message': user.username+' checkin in successful. Room number '+ user.selectedRoom,
          }
        });
        res.end();

      } catch (error) {
        console.error('Error occurred during search:', error);
        res.status(500).send({
          'success': false,
          'message': 'Apologies. Something went wrong. Please refresh and try again.',
          'responseBody': {
            'message': 'Apologies. Something went wrong. Please refresh and try again.',
          }
        });
        res.end();
      }
    }
  } catch (error) {
    console.error('Error:', error);
    console.error('Error occurred during search:', error);
          res.status(500).send({
            'success': false,
            'message': 'Apologies. Something went wrong. Please refresh and try again.',
            'responseBody': {
              'message': 'Apologies. Something went wrong. Please refresh and try again.',
            }
          });
          res.end();
  } finally {
    await mongoClient.close();
  }

});


// Function to search for a row with a particular value in the specified column
async function searchRow(csvFilePath, columnName, searchValue, callback) {
  const results = [];
  
  fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (data) => {
          // Check if the value in the specified column matches the search value
          if (data[columnName] === searchValue) {
              results.push(data);
          }
          
      })
      .on('end', () => {
          callback(null, results);
      })
      .on('error', (error) => {
          callback(error);
      });
}


module.exports = router;

module.exports = router;