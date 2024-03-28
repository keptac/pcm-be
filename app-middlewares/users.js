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

  const sender = req.body.requestBody.phoneNumber;
  console.log("+++++++++++++ "+ sender);
  console.log("received to checking from app for  "+ sender);
  console.log("+++++++++++++ "+ sender);

  try {
    await mongoClient.connect();
    const db = mongoClient.db('pcmmiscon'); 

    const usersCollection = db.collection('users');
    let user = await usersCollection.findOne({ _id: "263"+sender });

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
              
              await usersCollection.insertOne({
                _id: "263"+sender, 
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

            let userCreated = await usersCollection.findOne({ _id: sender });

            res.status(200).send({
              'success': true,
              'message': registeredUser.Name+' checkin successful.',
              'responseBody': {
                'message': registeredUser.Name+' checkin successful. Room number  NOT ALLOCATED',
                userCreated
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
        await usersCollection.updateOne({ _id: "263"+sender }, { $set: {  checkinStatus: 'CHECKED IN' } });

        res.status(200).send({
          'success': true,
          'message': user.username+' checkin successful.',
          'responseBody': {
            'message': user.username+' checkin successful. Room number '+ user.selectedRoom,
            user
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

  const senderId = req.body.requestBody.id;
  const meal = req.body.requestBody.meal;
  const day = req.body.requestBody.day;


  console.log("received to canteen checkin from app for  "+ senderId);


  try {
    await mongoClient.connect();
    const db = mongoClient.db('pcmmiscon'); 
    const mealsCollection = db.collection('canteen');
    let mealTaken = await mealsCollection.findOne({ _id: senderId+"_"+meal+"_"+day });
var registeredUser="";

    const results = await new Promise((resolve, reject) => {

      console.log("finding for food"+ csvFilePath+":"+searchValue)
        searchRow(csvFilePath, "Phone", senderId, (error, results) => {
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
            
    }else{

      registeredUser = results[0].Name;

    }


    if (!mealTaken) {
      console.log("finding for new food")

            await mealsCollection.insertOne({
                _id: senderId+"_"+meal+"_"+day, 
                attendeedId: senderId,
                username:registeredUser, 
                meal:meal,
                day: day,
                status:"TAKEN",
            });

            res.status(200).send({
              'success': true,
              'message':`Checkin ${meal} successful.`,
              'responseBody': {
                message: `Checkin ${day} ${meal} successful.`,
                userMealId:  senderId+"_"+meal+"_"+day, 
                username:registeredUser, 
                mealName: day+" "+meal,
                checkinStatus:"TAKEN",
              }
            });
            res.end();
      }else{
            res.status(200).send({
              'success': false,
              'message':`User  already eaten.`,
              'responseBody': {
                message: `User already eaten ${day} ${meal}.`,
                userMealId:  senderId+"_"+meal+"_"+day, 
                username:registeredUser, 
                mealName: day+" "+meal,
                checkinStatus:"TAKEN"
              }
            });
            res.end();
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