const express = require('express');
const router = express.Router();
const { MessagingResponse } = require('twilio').twiml;
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
  }
});


const aggLadiesRooms = [
  {
    '$unwind': '$ladies_rooms.rooms'
  }, {
    '$match': {
      'ladies_rooms.rooms.availableBeds': {
        '$gt': 0
      }
    }
  }, {
    '$project': {
      '_id': 0, 
      'roomNumber': {
        '$concat': [
          '$ladies_rooms.rooms.hostel', '_', '$ladies_rooms.rooms.roomNumber', '_', '$ladies_rooms.rooms.floor'
        ]
      }, 
      'availableBeds': '$ladies_rooms.rooms.availableBeds'
    }
  }
];

const aggGentsRooms = [
  {
    '$unwind': '$gents_rooms.rooms'
  }, {
    '$match': {
      'gents_rooms.rooms.availableBeds': {
        '$gt': 0
      }
    }
  }, {
    '$project': {
      '_id': 0, 
      'roomNumber': {
        '$concat': [
          '$gents_rooms.rooms.hostel', '_', '$gents_rooms.rooms.roomNumber', '_', '$gents_rooms.rooms.floor'
        ]
      }, 
      'availableBeds': '$gents_rooms.rooms.availableBeds'
    }
  }
];


router.post('/webhook', async (req, res) => {


  const incomingMsg = req.body.Body || '';
  const sender = req.body.From.replace("whatsapp:+","") || '';

  const twiml = new MessagingResponse();


  try {
    await mongoClient.connect();
    const db = mongoClient.db('pcmmiscon'); 

    const usersCollection = db.collection('users');
    let user = await usersCollection.findOne({ _id: sender });


    if (!user) {
      const columnName = 'Phone'; 
      const searchValue = sender.substring(sender.length - 9);
      let registeredUser;
  
      try {
          const results = await new Promise((resolve, reject) => {
              searchRow(csvFilePath, columnName, searchValue, (error, results) => {
                  if (error) {
                      console.error('Error Occurred:', error);
                      reject(error);
                  } else {
                      resolve(results);
                  }
              });
          });
  
          if (results.length === 0) {
              twiml.message("We could not find your registration record. Please contact your Association president for verification if you registered.");
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
                bookingStatus: '', 
                selectedRoom: 'NONE',
                checkinStatus: 'NOT CHECKED IN'
            });
  
            twiml.message(`Hello  ${registeredUser.Name || 'Guest'}. Welcome to ZEUC PCM Mission conference!\n\nMenu:\n1. Registration status\n2. Book a room\n3. Program outline\n4. Check-in`);
      
          }
  
         
  
      } catch (error) {
          console.error('Error occurred during search:', error);
          twiml.message("I'm sorry, We could not find your registration record. Please contact your Association president for verification.");
      }
  }
  else{

      if (incomingMsg.toLowerCase() === 'hi'||incomingMsg.toLowerCase() === 'hello') {
        twiml.message(`Hello  ${user.username || 'Guest'}. Welcome to ZEUC PCM Mission conference!\n\nMenu:\n1. Registration status\n2. Book a room\n3. Program outline\n4. Check-in`);
      } else {
 
     if (user && !user.username) {
       await usersCollection.updateOne({ _id: sender }, { $set: { username: incomingMsg } });
       twiml.message(`Hello  ${user.username || 'Guest'}. Welcome to ZEUC PCM Mission conference!\n\nMenu:\n1. Registration status\n2. Book a room\n3. Program outline\n4. Check-in`);
      } else {
         if (incomingMsg.toLowerCase().includes('book a room')||incomingMsg.toLowerCase()==='2') {
           try {
            const roomsCollection = db.collection('rooms');

             const cursor = roomsCollection.aggregate(aggLadiesRooms);
             const availableLadiesRooms = await cursor.toArray();

             const cursorMale = roomsCollection.aggregate(aggGentsRooms);
             const availableMaleRooms = await cursorMale.toArray();

             twiml.message("This option is coming soon.");

          //   if(user.bookingStatus==="BOOKED"){
          //      twiml.message(`Hey ${user.username}, You selected a room (Number: ${user.selectedRoom}) already.`);
          //  }else{

          //   if(user.gender==="M"){

          //     if (availableMaleRooms.length > 0) {
          //       let roomOptions = "Available Gents Hostels:\n";
          //       availableMaleRooms.forEach(room => {
          //         roomOptions += `Room ${room.roomNumber} - Available Beds: ${room.availableBeds}\n`;
          //       });
          //       twiml.message(roomOptions);
          //       await usersCollection.updateOne({ _id: sender }, { $set: { bookingStatus: 'selecting_room' } });
          //     } else {
          //       twiml.message("Sorry, there are no available rooms at the moment.");
          //     }

          //   }else{

          //     console.log("FEMALE HOSTELS")
          //     if (availableLadiesRooms.length > 0) {
          //       let roomOptions = "Available Ladies Hostels:\n";
          //       availableLadiesRooms.forEach(room => {
          //         roomOptions += `Room ${room.roomNumber} - Available Beds: ${room.availableBeds}\n`;
          //       });
          //       twiml.message(roomOptions);
          //       await usersCollection.updateOne({ _id: sender }, { $set: { bookingStatus: 'selecting_room' } });
          //     } else {
          //       twiml.message("Sorry, there are no available rooms at the moment.");
          //     }
          //   }

          //  }
           } catch (error) {
             console.error('Error retrieving available rooms:', error);
             twiml.message("Oops! Something went wrong. Please try again later.");
           }
         } else if (user.bookingStatus === 'selecting_room') {
           try {
              const roomsCollection = db.collection('rooms');
              const roomNumber = incomingMsg;
              const roomNumberParts = roomNumber.split('_');

                if (roomNumberParts.length !== 3) {
                  twiml.message('Invalid room number. Enter room number from the list above in the format: H1_R000_G');
                }else{

                const hostel = roomNumberParts[0];
                const room = roomNumberParts[1];
                const floor = roomNumberParts[2];


                const agg = user.gender==="M"?
                [
                  {
                    '$match': {
                      'gents_rooms.rooms.hostel': hostel, 
                      'gents_rooms.rooms.roomNumber': room, 
                      'gents_rooms.rooms.floor': floor, 
                      'gents_rooms.rooms.availableBeds': {
                        '$gt': 0
                      }
                    }
                  }, {
                    '$project': {
                      'selectedRoom': {
                        '$filter': {
                          'input': '$gents_rooms.rooms', 
                          'as': 'room', 
                          'cond': {
                            '$and': [
                              {
                                '$eq': [
                                  '$$room.hostel', hostel
                                ]
                              }, {
                                '$eq': [
                                  '$$room.roomNumber', room
                                ]
                              }, {
                                '$eq': [
                                  '$$room.floor', floor
                                ]
                              }, {
                                '$gt': [
                                  '$$room.availableBeds', 0
                                ]
                              }
                            ]
                          }
                        }
                      }
                    }
                  }, {
                    '$unwind': '$selectedRoom'
                  }, {
                    '$replaceRoot': {
                      'newRoot': '$selectedRoom'
                    }
                  }
                ]:[
                  {
                    '$match': {
                      'ladies_rooms.rooms.hostel': hostel, 
                      'ladies_rooms.rooms.roomNumber': room, 
                      'ladies_rooms.rooms.floor': floor, 
                      'ladies_rooms.rooms.availableBeds': {
                        '$gt': 0
                      }
                    }
                  }, {
                    '$project': {
                      'selectedRoom': {
                        '$filter': {
                          'input': '$ladies_rooms.rooms', 
                          'as': 'room', 
                          'cond': {
                            '$and': [
                              {
                                '$eq': [
                                  '$$room.hostel', hostel
                                ]
                              }, {
                                '$eq': [
                                  '$$room.roomNumber', room
                                ]
                              }, {
                                '$eq': [
                                  '$$room.floor', floor
                                ]
                              }, {
                                '$gt': [
                                  '$$room.availableBeds', 0
                                ]
                              }
                            ]
                          }
                        }
                      }
                    }
                  }, {
                    '$unwind': '$selectedRoom'
                  }, {
                    '$replaceRoot': {
                      'newRoot': '$selectedRoom'
                    }
                  }
                ]
  
                const cursor =  roomsCollection.aggregate(agg);
                const selectedRoom = await cursor.toArray();
                
                if (selectedRoom) {
  
                  await roomsCollection.updateOne({
                    'ladies_rooms.rooms.hostel': selectedRoom[0].hostel,
                    'ladies_rooms.rooms.roomNumber': selectedRoom[0].roomNumber,
                    'ladies_rooms.rooms.floor': selectedRoom[0].floor,
                    'ladies_rooms.rooms.availableBeds': { $gt: 0 }
                  }, {
                    $inc: {
                      'ladies_rooms.rooms.$.availableBeds': -1
                    }
                  });
  
                  await usersCollection.updateOne({ _id: sender }, { $set: { bookingStatus: 'room_selected', selectedRoom: roomNumber } });
                  twiml.message(`You have successfully booked Room ${roomNumber}. Would you like to confirm your booking? (Reply 'yes' or 'no')`);
                } else {
                  twiml.message(`Room ${roomNumber} is fully booked. Please select another room.`);
                }
               }
 
               
             
           } catch (error) {
             console.error('Error selecting room:', error);
             twiml.message("Oops! Something went wrong. Please try again later.");
           }
         } else if (user.bookingStatus === 'room_selected') {
           if (incomingMsg.toLowerCase() === 'yes') {
             const selectedRoom = user.selectedRoom;
             await usersCollection.updateOne({ _id: sender }, { $set: { bookingStatus: 'BOOKED'} });
             twiml.message(`Your booking for Room ${selectedRoom} has been confirmed.`);
             twiml.message(`Hello  ${user.username || 'Guest'}. Welcome to ZEUC PCM Mission conference!\n\nMenu:\n1. Book a room\n2. Registration status\n3. Program outline`);
 
           } else if (incomingMsg.toLowerCase() === 'no') {
             const selectedRoom = user.selectedRoom;
             const roomsCollection = db.collection('rooms');
 
             await roomsCollection.updateOne({ number: selectedRoom }, { $inc: { beds: 1 } });
 
             await usersCollection.updateOne({ _id: sender }, { $set: { bookingStatus: '', selectedRoom: '' } });
             twiml.message(`Your booking for Room ${selectedRoom} has been cancelled.`);
           } else {
             twiml.message(`Please reply with 'yes' to confirm your booking or 'no' to cancel.`);
           }
         } else if (incomingMsg.toLowerCase().includes('registration status')||incomingMsg.toLowerCase().includes('1')) {
           // Handle registration status request


           try {
             const userData = await usersCollection.findOne({ _id: sender });
             if (userData) {


              let twilioMessage = `*Name:* ${userData.username}\n`;
                  twilioMessage += `*Gender:* ${userData.gender}\n`;
                  twilioMessage += `*Designation:* ${userData.title}\n`;
                  twilioMessage += `*Email:* ${userData.email ? userData.email : '*(No email provided)*'}\n\n`;
                  twilioMessage += `*Sessions:*\n\n - ${userData.sessions.replace(/, /g, '\n- ')}\n\n`;
                  twilioMessage += `*Institute:* ${userData.institute}\n`;
                  twilioMessage += `*Registration Status:* ${userData.registrationStatus}\n`;
                  twilioMessage += `*Booked Room:* ${userData.selectedRoom}\n`;
                  twilioMessage += `*Check In Status:* ${userData.checkinStatus}\n`;

              // userMap = userData
               twiml.message(`Your registration details:\n\n${twilioMessage}`);
             } else {
               twiml.message(`Your registration details are not found.`);
             }
           } catch (error) {
             console.error('Error retrieving user registration details:', error);
             twiml.message(`Oops! Something went wrong. Please try again later.`);
           }
         } else if (incomingMsg.toLowerCase().includes('program outline')||incomingMsg.toLowerCase().includes('3')) {
           twiml.message("Program outline not available yet.");
         } else if (incomingMsg.toLowerCase().replace("-","").includes('checkin') || incomingMsg.toLowerCase().includes('4')) {
          twiml.message("You need to first book a room.");
        } else {
           twiml.message("I'm sorry, I didn't understand that. Can you select options from the menu below?");
           twiml.message(`Hello  ${user.username || 'Guest'}. Welcome to ZEUC PCM Mission conference!\n\nMenu:\n1. Registration status\n2. Book a room\n3. Program outline\n4. Check-in`);
      
         }
     }}
    }

  } catch (error) {
    console.error('Error:', error);
    twiml.message(`Oops! Something went wrong. Please try again later.`);
  } finally {
    await mongoClient.close();
  }

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());

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