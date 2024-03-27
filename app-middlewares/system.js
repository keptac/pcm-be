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
  },
  maxPoolSize: 50, // Adjust as per your requirements
  wtimeoutMS: 2500,
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
      'availableBeds': '$ladies_rooms.rooms.availableBeds',
      'reservation': '$ladies_rooms.rooms.reservation'
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
      'availableBeds': '$gents_rooms.rooms.availableBeds',
      'reservation': '$gents_rooms.rooms.reservation'
    }
  }
];


router.post('/webhook', async (req, res) => {

  const incomingMsg = req.body.Body || '';
  const sender = req.body.From.replace("whatsapp:+","") || '';

  const twiml = new MessagingResponse();

  console.log("received message from "+ sender);

  try {
    await mongoClient.connect();
    const db = mongoClient.db('pcmmiscon'); 

    const usersCollection = db.collection('users');
    const tshirtsCollection = db.collection('tshirt_orders');

    let user = await usersCollection.findOne({ _id: sender });

    let userTshirtOrder = await tshirtsCollection.findOne({ _id: sender });

    if (incomingMsg.toLowerCase().includes('hi')||incomingMsg.toLowerCase() === 'hello') {

      user?twiml.message(`Hello  ${user.username || 'Guest'}. ZEUC PCM Mission Conference conference!\n\nMenu:\n1. Registration status\n2. Book/Select a room\n3. Program outline\n4. Theme Song\n5. Check for someone\n6. PCM Shop (Order Now)`)
      : twiml.message(`Welcome to ZEUC PCM Mission conference! . ZEUC PCM Mission Conference conference!\n\nMenu:\n1. Registration status\n2. Book/Select a room\n3. Program outline\n4. Theme Song\n5. Check for someone\n6. PCM Shop (Order Now)`);
    } else{
        if( userTshirtOrder && userTshirtOrder.orderStatus==="order_started"){

          console.log(sender+" ordering tshirt started")

          if(incomingMsg.length>5){
            await tshirtsCollection.updateOne({ _id: sender }, { $set: { order:incomingMsg, orderStatus: 'order_completed' } });
            twiml.message(`Order was successfully placed. We are now processing your order.`);
          }else{

            twiml.message(`

                *Welcome to ZEUC PCM Miscon Shop.* 
                              
                Please place your order in the format: SIZE, QUANTITY, TYPE, COLOR

                *For example: Small, 1, Golf, White*
                              
                We have the below options available:

                *Tshirts (Golf, Regular):*
                Light Blue
                Navy Blue
                Charcoal Grey
                Dark Grey
                Black
                White
                Pink
                              
                *Hoodies:*
                White 
                Grey 
                Navy Blue
                Black
                              
                Sizes: *S, M, L*
            `);

          }

        }else if (incomingMsg.toLowerCase().replace("-","").includes('order') || incomingMsg.toLowerCase().replace("-","").includes('tshirt') || incomingMsg.toLowerCase().replace("-","").includes('hood')||incomingMsg.toLowerCase() === '6') {

          if(userTshirtOrder && userTshirtOrder.orderStatus==="order_completed"){
            twiml.message('You have already ordered a Tshirt. Here is your order: '+ userTshirtOrder.order);
            twiml.message(`Welcome to ZEUC PCM Mission conference!\n\nMenu:\n1. Registration status\n2. Book/Select a room\n3. Program outline\n4. Theme Song\n5. Check for someone\n6. PCM Shop (Order Now)`);

          }else{
            twiml.message(`

                *Welcome to ZEUC PCM Miscon Shop.* 
                              
                Please place your order in the format: SIZE, QUANTITY, TYPE, COLOR

                *For example: Small, 1, Golf, White*
                              
                We have the below options available:

                *Tshirts (Golf, Regular):*
                Light Blue
                Navy Blue
                Charcoal Grey
                Dark Grey
                Black
                White
                Pink
                              
                *Hoodies:*
                White 
                Grey 
                Navy Blue
                Black
                              
                Sizes: *S, M, L*
            `);

            await tshirtsCollection.insertOne({
              _id: sender, 
              owner: user?user.username:"",
              institute: user?user.institute:"",
              order: "", 
              orderStatus:"order_started",
          });
    
          }

      }else{

        if (!user) {
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
                  twiml.message("We could not find your registration record 🥺. Please contact your Association president for verification if you registered.");
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
      
                twiml.message(`Hello  ${registeredUser.Name || 'Guest'}. ZEUC PCM Mission Conference conference!\n\nMenu:\n1. Registration status\n2. Book/Select a room\n3. Program outline\n4. Theme Song\n5. Check for someone\n6. PCM Shop (Order Now)`);
          
              }
      
            
      
          } catch (error) {
              console.error('Error occurred during search:', error);
              twiml.message("I'm sorry, We could not find your registration record. Please contact your Association president for verification.");
          }
        }
        else{

          if (user && !user.username) {
            await usersCollection.updateOne({ _id: sender }, { $set: { username: incomingMsg } });
            twiml.message(`Hello  ${user.username || 'Guest'}. ZEUC PCM Mission Conference conference!\n\nMenu:\n1. Registration status\n2. Book/Select a room\n3. Program outline\n4. Theme Song\n5. Check for someone\n6. PCM Shop (Order Now)`);
            } else {
              if (incomingMsg.toLowerCase().includes('book a room')||incomingMsg.toLowerCase()==='2') {



                try {
                  const roomsCollection = db.collection('rooms');

                  const cursor = roomsCollection.aggregate(aggLadiesRooms);
                  const availableLadiesRooms = await cursor.toArray();

                  const cursorMale = roomsCollection.aggregate(aggGentsRooms);
                  const availableMaleRooms = await cursorMale.toArray();

                  twiml.message("🛠️ This option has been temporarily closed for maintanance 🛠️.");

                  console.log("Sender request room: "+ incomingMsg);

                  
                //   if(user.bookingStatus==="BOOKED"){
                //      twiml.message(`Hey ${user.username}, You have already selected/been allocated a room.\n\n*Number: ${user.selectedRoom}*.`);
                //  }else{

                  
                //   if(user.gender==="M"){

                //     if (availableMaleRooms.length > 0) {
                //       twiml.message("Room Key\nH1 - indicates hostel number\nR100 - indicates room number\nG - indicates Floor | Ground(G), Upper(U)\n\n To select a prefered room from the list write the room number as is on the list.")
                
                //       let roomOptions = `Available ${user.title} Gents Hostels:\n`;

                
                //       availableMaleRooms.forEach(room => {

                //         if(user.title.toLowerCase()==='student'){

                //           console.log("Student rooms request : "+ incomingMsg);
                //           if(room.reservation ==='Student'){
                //             roomOptions += `Room ${room.roomNumber} - Available Beds: ${room.availableBeds}\n`;
                //           }
                          
                //         }else{
                //           console.log("Alumni rooms request : "+ incomingMsg);

                //           if(room.reservation ==='Alumni'){
                //             roomOptions += `Room ${room.roomNumber} - Available Beds: ${room.availableBeds}\n`;
                //           }
                //         }
                        

                //       });
                //       twiml.message(roomOptions);
                //       await usersCollection.updateOne({ _id: sender }, { $set: { bookingStatus: 'selecting_room' } });
                //     } else {
                //       twiml.message("Sorry, there are no available rooms at the moment.");
                //     }

                //   }else{

                //     console.log("FEMALE HOSTELS")
                //     if (availableLadiesRooms.length > 0) {
                //       twiml.message("Room Key\nH1 - indicates hostel number\nR000 - indicates room number\nG - indicates Floor | Ground(G), Upper(U)\n\n To select a prefered from the list write in the format below. \nFor example H1_R000_U")
                
                //       let roomOptions = `Available ${user.title} Ladies Hostels:\n`
                //       availableLadiesRooms.forEach(room => {

                //         if(user.title.toLowerCase()==='student'){

                //           console.log("Student rooms request : "+ incomingMsg);
                //           if(room.reservation ==='Student'){
                //             roomOptions += `Room ${room.roomNumber} - Available Beds: ${room.availableBeds}\n`;
                //           }
                          
                //         }else{
                //           console.log("Alumni rooms request : "+ incomingMsg);
                //           if(room.reservation ==='Alumni'){
                //             roomOptions += `Room ${room.roomNumber} - Available Beds: ${room.availableBeds}\n`;
                //           }
                //         }
                        
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
                  twiml.message("Oops! Something went wrong, our engineers are working to restore normalcy. Please try again later.");
                }
              } 
              
              
              
              
              //ROOMS SELECTION WORKING
              
              
                            
              else  if (incomingMsg.toLowerCase()==='404') {


                try {
                  const roomsCollection = db.collection('rooms');

                  const cursor = roomsCollection.aggregate(aggLadiesRooms);
                  const availableLadiesRooms = await cursor.toArray();

                  const cursorMale = roomsCollection.aggregate(aggGentsRooms);
                  const availableMaleRooms = await cursorMale.toArray();

                  
                  if(user.bookingStatus==="BOOKED"){
                    twiml.message(`Hey ${user.username}, You have already selected/been allocated a room.\n\n*Number: ${user.selectedRoom}*.`);
                }else{

                  
                  if(user.gender==="M"){



                    if (availableMaleRooms.length > 0) {
                      twiml.message("Room Key\nH1 - indicates hostel number\nR100 - indicates room number\nG - indicates Floor | Ground(G), Upper(U)\n\n To select a prefered room from the list write the exact format as on the list.")
                
                      let roomOptions = `Available ${user.title} Gents Hostels:\n\n`;

                      var characterCount =0

                      availableMaleRooms.forEach(room => {
                        if(user.title.toLowerCase()=='student'){
                          if(room.reservation.toLowerCase() =='student'){

                            if(characterCount<=1600){
                              roomOptions += `${room.roomNumber} - Beds: ${room.availableBeds}\n`;
                              characterCount = roomOptions.length
                            }

                            console.log("Student rooms request : "+ room.roomNumber);
                          }
                          
                        }else{
                          console.log("Alumni rooms request : "+ incomingMsg);

                          if(room.reservation.toLowerCase() ==='alumni'){

                            if(characterCount<=1600){
                              roomOptions += `${room.roomNumber} - Beds: ${room.availableBeds}\n`;
                              characterCount = roomOptions.length
                            }


                          }
                        }
                        

                      });
                      console.log(roomOptions);
                      await usersCollection.updateOne({ _id: sender }, { $set: { bookingStatus: 'selecting_room' } });
                      twiml.message(roomOptions);
                    } else {
                      twiml.message("Sorry, there are no available rooms at the moment.");
                    }

                  }else{

                    console.log("FEMALE HOSTELS")
                    if (availableLadiesRooms.length > 0) {
                      twiml.message("Room Key\nH1 - indicates hostel number\nR000 - indicates room number\nG - indicates Floor | Ground(G), Upper(U)\n\n To select a prefered room from the list write in the format below.")
                
                      let roomOptions = `Available ${user.title} Ladies Hostels:\n`

                      var characterCount =0

                      availableLadiesRooms.forEach(room => {

                        if(user.title.toLowerCase()=='student'){

                          console.log("Student rooms request : "+ incomingMsg);
                          if(room.reservation.toLowerCase() =='student'){
                            if(characterCount<=1600){
                              roomOptions += `${room.roomNumber} - Beds: ${room.availableBeds}\n`;
                              characterCount = roomOptions.length
                            }

                          }
                          
                        }else{
                          console.log("Alumni rooms request : "+ incomingMsg);
                          if(room.reservation.toLowerCase()==='alumni'){

                            if(characterCount<=1600){
                              roomOptions += `${room.roomNumber} - Beds: ${room.availableBeds}\n`;
                              characterCount = roomOptions.length
                            }
                          
                          }
                        }
                        
                      });
                      await usersCollection.updateOne({ _id: sender }, { $set: { bookingStatus: 'selecting_room' } });
                      twiml.message(roomOptions);
                    } else {
                      twiml.message("Sorry, there are no available rooms at the moment.");
                    }
                  }

                 }

                } catch (error) {

                  console.error('Error retrieving available rooms:', error);
                  twiml.message("Oops! Something went wrong, our engineers are working to restore normalcy. Please try again later.");

                }
              } else if (user.bookingStatus === 'selecting_room') {
                try {
                    const roomsCollection = db.collection('rooms');
                    const roomNumber = incomingMsg;
                    const roomNumberParts = roomNumber.substring(roomNumber.length - 9).split('_');

                      if (roomNumberParts.length !== 3) {
                        twiml.message('Invalid room number. Enter room number from the list above in the format: H1_R000_G');
                      }else{

                      console.log("Sender request: "+ user.bookingStatus);

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
                      
                      if (selectedRoom.length>0) {

                        if(user.gender==="F"){

                          await roomsCollection.updateOne({
                            'ladies_rooms.rooms.hostel': selectedRoom[0].hostel,
                            'ladies_rooms.rooms.roomNumber': selectedRoom[0].roomNumber,
                            'ladies_rooms.rooms.floor': selectedRoom[0].floor,
                            'ladies_rooms.rooms.reservation': selectedRoom[0].reservation,
                            'ladies_rooms.rooms.availableBeds': { $gt: 0 }
                        }, {
                            $inc: {
                                'ladies_rooms.rooms.$.availableBeds': -1
                            }
                        });

                        }else{

                          await roomsCollection.updateOne({
                            'gents_rooms.rooms.hostel': selectedRoom[0].hostel,
                            'gents_rooms.rooms.roomNumber': selectedRoom[0].roomNumber,
                            'gents_rooms.rooms.floor': selectedRoom[0].floor,
                            'gents_rooms.rooms.reservation': selectedRoom[0].reservation,
                            'gents_rooms.rooms.availableBeds': { $gt: 0 }
                          }, {
                            $inc: {
                              'gents_rooms.rooms.$.availableBeds': -1
                            }
                          });
                        }
        
        
                        await usersCollection.updateOne({ _id: sender }, { $set: { bookingStatus: 'room_selected', selectedRoom: roomNumber } });
                        twiml.message(`You have successfully booked Room ${roomNumber}. Would you like to confirm your booking? (Reply 'yes' or 'no')`);
                      } else {
                        twiml.message(`Invalid room selection ${roomNumber}. Please enter correctly room.`);
                      }
                    }
      
                    
                  
                } catch (error) {
                  console.error('Error selecting room:', error);
                  twiml.message("Oops! Something went wrong, our engineers are working to restore normalcy. Please try again later.");
                }
              } else if (user.bookingStatus === 'room_selected') {
                if (incomingMsg.toLowerCase() === 'yes') {
                  const selectedRoom = user.selectedRoom;
                  await usersCollection.updateOne({ _id: sender }, { $set: { bookingStatus: 'BOOKED'} });
                  twiml.message(`Your booking for Room ${selectedRoom} has been confirmed.`);
                  twiml.message(`Hello  ${user.username || 'Guest'}. ZEUC PCM Mission Conference conference!\n\nMenu:\n1. Book/Select a room\n2. Registration status\n3. Program outline\n4. Theme song`);
      
                } else if (incomingMsg.toLowerCase() === 'no') {
                  const selectedRoom = user.selectedRoom;
                  const roomsCollection = db.collection('rooms');
      
                  await roomsCollection.updateOne({ number: selectedRoom }, { $inc: { availableBeds: 1 } });
      
                  await usersCollection.updateOne({ _id: sender }, { $set: { bookingStatus: '', selectedRoom: '' } });
                  twiml.message(`Your booking for Room ${selectedRoom} has been cancelled.`);
                } else {
                  twiml.message(`Please reply with 'yes' to confirm your booking or 'no' to cancel.`);
                }
              }

                     
              
              //   if (incomingMsg.toLowerCase().includes('book a room')||incomingMsg.toLowerCase()==='2') {


              //   try {
              //     const roomsCollection = db.collection('rooms');

              //     const cursor = roomsCollection.aggregate(aggLadiesRooms);
              //     const availableLadiesRooms = await cursor.toArray();

              //     const cursorMale = roomsCollection.aggregate(aggGentsRooms);
              //     const availableMaleRooms = await cursorMale.toArray();

                  
              //     if(user.bookingStatus==="BOOKED"){
              //       twiml.message(`Hey ${user.username}, You have already selected/been allocated a room.\n\n*Number: ${user.selectedRoom}*.`);
              //   }else{

                  
              //     if(user.gender==="M"){



              //       if (availableMaleRooms.length > 0) {
              //         twiml.message("Room Key\nH1 - indicates hostel number\nR100 - indicates room number\nG - indicates Floor | Ground(G), Upper(U)\n\n To select a prefered room from the list write the exact format as on the list.")
                
              //         let roomOptions = `Available ${user.title} Gents Hostels:\n\n`;

              //         var characterCount =0

              //         availableMaleRooms.forEach(room => {
              //           if(user.title.toLowerCase()=='student'){
              //             if(room.reservation.toLowerCase() =='student'){

              //               if(characterCount<=1600){
              //                 roomOptions += `${room.roomNumber} - Beds: ${room.availableBeds}\n`;
              //                 characterCount = roomOptions.length
              //               }

              //               console.log("Student rooms request : "+ room.roomNumber);
              //             }
                          
              //           }else{
              //             console.log("Alumni rooms request : "+ incomingMsg);

              //             if(room.reservation.toLowerCase() ==='alumni'){

              //               if(characterCount<=1600){
              //                 roomOptions += `${room.roomNumber} - Beds: ${room.availableBeds}\n`;
              //                 characterCount = roomOptions.length
              //               }


              //             }
              //           }
                        

              //         });
              //         console.log(roomOptions);
              //         await usersCollection.updateOne({ _id: sender }, { $set: { bookingStatus: 'selecting_room' } });
              //         twiml.message(roomOptions);
              //       } else {
              //         twiml.message("Sorry, there are no available rooms at the moment.");
              //       }

              //     }else{

              //       console.log("FEMALE HOSTELS")
              //       if (availableLadiesRooms.length > 0) {
              //         twiml.message("Room Key\nH1 - indicates hostel number\nR000 - indicates room number\nG - indicates Floor | Ground(G), Upper(U)\n\n To select a prefered from the list write in the format below. \nFor example H1_R000_U")
                
              //         let roomOptions = `Available ${user.title} Ladies Hostels:\n`

              //         var characterCount =0

              //         availableLadiesRooms.forEach(room => {

              //           if(user.title.toLowerCase()=='student'){

              //             console.log("Student rooms request : "+ incomingMsg);
              //             if(room.reservation.toLowerCase() =='student'){
              //               if(characterCount<=1600){
              //                 roomOptions += `${room.roomNumber} - Beds: ${room.availableBeds}\n`;
              //                 characterCount = roomOptions.length
              //               }

              //             }
                          
              //           }else{
              //             console.log("Alumni rooms request : "+ incomingMsg);
              //             if(room.reservation.toLowerCase()==='alumni'){

              //               if(characterCount<=1600){
              //                 roomOptions += `${room.roomNumber} - Beds: ${room.availableBeds}\n`;
              //                 characterCount = roomOptions.length
              //               }
                          
              //             }
              //           }
                        
              //         });
              //         await usersCollection.updateOne({ _id: sender }, { $set: { bookingStatus: 'selecting_room' } });
              //         twiml.message(roomOptions);
              //       } else {
              //         twiml.message("Sorry, there are no available rooms at the moment.");
              //       }
              //     }

              //    }

              //   } catch (error) {

              //     console.error('Error retrieving available rooms:', error);
              //     twiml.message("Oops! Something went wrong, our engineers are working to restore normalcy. Please try again later.");

              //   }
              // } else if (user.bookingStatus === 'selecting_room') {
              //   try {
              //       const roomsCollection = db.collection('rooms');
              //       const roomNumber = incomingMsg;
              //       const roomNumberParts = roomNumber.substring(roomNumber.length - 9).split('_');

              //         if (roomNumberParts.length !== 3) {
              //           twiml.message('Invalid room number. Enter room number from the list above in the format: H1_R000_G');
              //         }else{

              //         console.log("Sender request: "+ user.bookingStatus);

              //         const hostel = roomNumberParts[0];
              //         const room = roomNumberParts[1];
              //         const floor = roomNumberParts[2];


              //         const agg = user.gender==="M"?
              //         [
              //           {
              //             '$match': {
              //               'gents_rooms.rooms.hostel': hostel, 
              //               'gents_rooms.rooms.roomNumber': room, 
              //               'gents_rooms.rooms.floor': floor, 
              //               'gents_rooms.rooms.availableBeds': {
              //                 '$gt': 0
              //               }
              //             }
              //           }, {
              //             '$project': {
              //               'selectedRoom': {
              //                 '$filter': {
              //                   'input': '$gents_rooms.rooms', 
              //                   'as': 'room', 
              //                   'cond': {
              //                     '$and': [
              //                       {
              //                         '$eq': [
              //                           '$$room.hostel', hostel
              //                         ]
              //                       }, {
              //                         '$eq': [
              //                           '$$room.roomNumber', room
              //                         ]
              //                       }, {
              //                         '$eq': [
              //                           '$$room.floor', floor
              //                         ]
              //                       }, {
              //                         '$gt': [
              //                           '$$room.availableBeds', 0
              //                         ]
              //                       }
              //                     ]
              //                   }
              //                 }
              //               }
              //             }
              //           }, {
              //             '$unwind': '$selectedRoom'
              //           }, {
              //             '$replaceRoot': {
              //               'newRoot': '$selectedRoom'
              //             }
              //           }
              //         ]:[
              //           {
              //             '$match': {
              //               'ladies_rooms.rooms.hostel': hostel, 
              //               'ladies_rooms.rooms.roomNumber': room, 
              //               'ladies_rooms.rooms.floor': floor, 
              //               'ladies_rooms.rooms.availableBeds': {
              //                 '$gt': 0
              //               }
              //             }
              //           }, {
              //             '$project': {
              //               'selectedRoom': {
              //                 '$filter': {
              //                   'input': '$ladies_rooms.rooms', 
              //                   'as': 'room', 
              //                   'cond': {
              //                     '$and': [
              //                       {
              //                         '$eq': [
              //                           '$$room.hostel', hostel
              //                         ]
              //                       }, {
              //                         '$eq': [
              //                           '$$room.roomNumber', room
              //                         ]
              //                       }, {
              //                         '$eq': [
              //                           '$$room.floor', floor
              //                         ]
              //                       }, {
              //                         '$gt': [
              //                           '$$room.availableBeds', 0
              //                         ]
              //                       }
              //                     ]
              //                   }
              //                 }
              //               }
              //             }
              //           }, {
              //             '$unwind': '$selectedRoom'
              //           }, {
              //             '$replaceRoot': {
              //               'newRoot': '$selectedRoom'
              //             }
              //           }
              //         ]
        
              //         const cursor =  roomsCollection.aggregate(agg);
              //         const selectedRoom = await cursor.toArray();
                      
              //         if (selectedRoom) {
        
              //           await roomsCollection.updateOne({
              //             'ladies_rooms.rooms.hostel': selectedRoom[0].hostel,
              //             'ladies_rooms.rooms.roomNumber': selectedRoom[0].roomNumber,
              //             'ladies_rooms.rooms.floor': selectedRoom[0].floor,
              //             'ladies_rooms.rooms.availableBeds': { $gt: 0 }
              //           }, {
              //             $inc: {
              //               'ladies_rooms.rooms.$.availableBeds': -1
              //             }
              //           });
        
              //           await usersCollection.updateOne({ _id: sender }, { $set: { bookingStatus: 'room_selected', selectedRoom: roomNumber } });
              //           twiml.message(`You have successfully booked Room ${roomNumber}. Would you like to confirm your booking? (Reply 'yes' or 'no')`);
              //         } else {
              //           twiml.message(`Invalid room selection ${roomNumber}. Please enter correctly room.`);
              //         }
              //       }
      
                    
                  
              //   } catch (error) {
              //     console.error('Error selecting room:', error);
              //     twiml.message("Oops! Something went wrong, our engineers are working to restore normalcy. Please try again later.");
              //   }
              // } else if (user.bookingStatus === 'room_selected') {
              //   if (incomingMsg.toLowerCase() === 'yes') {
              //     const selectedRoom = user.selectedRoom;
              //     await usersCollection.updateOne({ _id: sender }, { $set: { bookingStatus: 'BOOKED'} });
              //     twiml.message(`Your booking for Room ${selectedRoom} has been confirmed.`);
              //     twiml.message(`Hello  ${user.username || 'Guest'}. ZEUC PCM Mission Conference conference!\n\nMenu:\n1. Book/Select a room\n2. Registration status\n3. Program outline\n4. Theme song`);
      
              //   } else if (incomingMsg.toLowerCase() === 'no') {
              //     const selectedRoom = user.selectedRoom;
              //     const roomsCollection = db.collection('rooms');
      
              //     await roomsCollection.updateOne({ number: selectedRoom }, { $inc: { beds: 1 } });
      
              //     await usersCollection.updateOne({ _id: sender }, { $set: { bookingStatus: '', selectedRoom: '' } });
              //     twiml.message(`Your booking for Room ${selectedRoom} has been cancelled.`);
              //   } else {
              //     twiml.message(`Please reply with 'yes' to confirm your booking or 'no' to cancel.`);
              //   }
              // }

              
              
              
              else if (incomingMsg.toLowerCase().includes('registration status')||incomingMsg.toLowerCase() ==='1') {
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
                  twiml.message(`Oops! Something went wrong, our engineers are working to restore normalcy. Please try again later.`);
                }
              } 
              
              
              else if (incomingMsg.toLowerCase().includes('program outline')||incomingMsg.toLowerCase() === '3') {
                twiml.message("Program outline not available yet.");
              } 
              
              
              else if (incomingMsg.toLowerCase().includes('music') ||incomingMsg.toLowerCase().includes('theme song')||incomingMsg.toLowerCase().includes('song') || incomingMsg.toLowerCase() === '4') {

                const song = `
                  Written and Arranged by Delight Mandina

                  *Verse1:*
                  Into all the world we should go,
                  Preaching the gospel of the truth.
                  As the present day Waldenses,
                  With mission in our sight.
                  For the harvest is now ripen,
                  So send me, Lord, today.
                  As the ancient heroes, here I stand,
                  For without delay, I will go.

                  *Chorus*
                  Lord, make me Yours, 
                  Send me now today, 
                  As the present Waldense, 
                  I'll answer to the call.
                  Through valleys deep,
                  And mountains tall,
                  Even in opposition, 
                  I'll stand for the right, 
                  Never to fall.

                  *Verse 2*
                  In the world, my campus and workplace 
                  I will present you as you please
                  With the Holy Spirit leading
                  I will answer to the call.
                  Having faith as my compass, 
                  The world will know you this age.
                  As the ancient heroes here l stand 
                  Let your Spirit lead today
                  `
                twiml.message(song);
              } 
              
              
              else if (incomingMsg.toLowerCase().includes('someone') || incomingMsg.toLowerCase().includes('check for someone') || incomingMsg.toLowerCase() === '5') {
                await usersCollection.updateOne({ _id: sender }, { $set: { chatStatus: '3rd_party_verification' } });
                twiml.message("Please enter their phone number in the format: 0771000000");
              } 
              
              else if (user.chatStatus === '3rd_party_verification') {
                const thirdPartyNumber = incomingMsg.replace(" ","").substring(incomingMsg.replace(" ","").length - 9);
                try {
                  const userData = await usersCollection.findOne({ _id: "263"+thirdPartyNumber });
                  if (userData) {

                    console.log(userData +"Checking for user on their behalf")

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
                    twiml.message(`Your friend's registration details:\n\n${twilioMessage}`);

                    await usersCollection.updateOne({ _id: sender }, { $set: { chatStatus: '0' } });
                  } else {

                    let registeredUser;
                        const results = await new Promise((resolve, reject) => {
                          console.log("finding attendeee"+ csvFilePath+":"+thirdPartyNumber)
                              searchRow(csvFilePath, 'Phone', thirdPartyNumber, (error, results) => {
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
                            console.log("Sender registration not found: "+ thirdPartyNumber);
                            twiml.message("We could not find your friend's registration record 🥺. Please contact your Association president for verification if you registered.");
                        } else {
                            console.log("Found registered user:", results[0]);
                            registeredUser = results[0];
              
                            await usersCollection.insertOne({
                              _id: "263"+thirdPartyNumber, 
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

                          let twilioMessage = `*Name:* ${registeredUser.Name}\n`;
                              twilioMessage += `*Gender:* ${registeredUser.Gender}\n`;
                              twilioMessage += `*Designation:* ${registeredUser.Title}\n`;
                              twilioMessage += `*Email:* ${registeredUser.Email ? registeredUser.Email : '*(No email provided)*'}\n\n`;
                              twilioMessage += `*Institute:* ${registeredUser.Organization}\n`;
                              twilioMessage += `*Registration Status:* REGISTERED\n`;
                              twilioMessage += `*Booked Room:* NONE\n`;
                              twilioMessage += `*Check In Status:* NOT CHECKED IN\n`;

                  // userMap = userData
                    twiml.message(`Your friend's registration details:\n\n${twilioMessage}`);
                
                  }
                  }
                } catch (error) {
                  console.error('Error retrieving 3rd party user registration details:', error);
                  twiml.message(`Something went wrong, Please try again later.`);
                }
              }
              
                    
              else {
                twiml.message("I'm sorry, I didn't understand that. Can you select options from the menu below?");
                twiml.message(`Hello  ${user.username || 'Guest'}. ZEUC PCM Mission Conference conference!\n\nMenu:\n1. Registration status\n2. Book/Select a room\n3. Program outline\n4. Theme Song\n5. Check for someone\n6. PCM Shop (Order Now)`);
              }
          }
        }
    }
  }
  } catch (error) {
    console.error('Error:', error);
    twiml.message(`We are experiencing large number of requests at this moment. Please try again in a moment 🙏🏽.`);
  } finally {
    console.log("DB Connection closed");
    // await mongoClient.close();
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