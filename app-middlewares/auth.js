const express = require('express');
const randtoken = require('rand-token');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const Cryptr = require('cryptr');
const axios = require('axios');

const connection = require('../helpers/connection');
const query = require('../helpers/query');
const dbConfig = require('../dbConfig');
const logging = require('../helpers/logging');

const cryptr = new Cryptr('xplu-c0h-F345-g4t38a6');
const refreshTokens = {};
const SECRET = 'VERY_SECRET_KEY!';
const passportOpts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: SECRET
};

const router = express.Router();

passport.use(new JwtStrategy(passportOpts, function (jwtPayload, done) {
  const expirationDate = new Date(jwtPayload.exp * 1000);
  if (expirationDate < new Date()) {
    return done(null, false);
  }
  done(null, jwtPayload);
}));

passport.serializeUser(function (user, done) {
  done(null, user.username)
});

router.post('/signup', async (req, res) => {
  const conn = await connection(dbConfig).catch(e => { });
  const idNumber = req.body.requestBody.idNumber;
  const firstName = req.body.requestBody.firstName;
  const lastName = req.body.requestBody.lastName;
  const emailAddress = req.body.requestBody.email;
  const phoneNumber = req.body.requestBody.phoneNumber;
  const username = phoneNumber;
  const role = "CUSTOMER";
  const createdBy = "ADMIN";
  const initialPassword = req.body.requestBody.password;
  const passwordReset = 0;
  const password = cryptr.encrypt(initialPassword);

  const checkUser = await query(conn, `SELECT * FROM pcm_user WHERE email_address = '${emailAddress}' OR phone_number='${phoneNumber}'`);

  if (checkUser.length == 0) {
      const user = await query(conn, `INSERT INTO pcm_user (id_number, first_name, surname, email_address, phone_number, role, created_by) VALUES (?,?,?,?,?,?,?)`, [idNumber, firstName, lastName, emailAddress, phoneNumber, role, createdBy]);
      if (user == undefined) {
        logging('USER CREATION FAILED','SIGNUP','Error')
        res.status(200).send({
          'success': false,
          'message': 'Failed to create user',
          'responseBody': {
            'message': 'DB Error'
          }
        });
        res.end();
      } else {
        const userCred = await query(conn, `INSERT INTO pcm_login (username,password, password_reset, role) VALUES (?,?,?,?)`, [username, password, passwordReset, role]);
        if (userCred == undefined) {
          logging('USER CREATION FAILED','SIGNUP','Error')
          if (school != undefined) {
            res.status(200).send({
              'success': false,
              'message': 'Failed to grant user access',
              'responseBody': {
                'message': 'DB Error'
              }
            });
          }
          res.end();
        } else {
          logging('USER CREATED[ id: ' + idNumber + ': ' + firstName + ' ' + lastName  + ' ]','SIGNUP','Success');
          res.status(200).send({
            'success': true,
            'message': 'user added successfully',
            'responseBody': {
              "message": 'Success',
              "name":firstName + " " + lastName,
              "phoneNumber": phoneNumber,
              "role": "CUSTOMER",
            }
          });
          res.end();
        }
      }
  } else {
    logging('User already exist: \n' + JSON.stringify(checkUser) + ' \n','SIGNUP','Warn')
    res.status(200).send({
      'success': false,
      'message': 'Duplicate Entry',
      'responseBody': {
        'message': 'User with those details already exists.'
      }
    });
  }
  res.end();
});

router.put('/password-reset', async (req, res) => {
  const username = req.body.requestBody.username;
  const oldPassword = req.body.requestBody.oldPassword;
  const newPassword = req.body.requestBody.newPassword;
  const password = cryptr.encrypt(newPassword);

  const conn = await connection(dbConfig).catch(e => {});

  const results = await query(conn, `SELECT * FROM pcm_login WHERE id_number = '${username}'`).catch(console.log);
  if (results.length > 0) {

    if (cryptr.decrypt(results[0].password) == oldPassword) {
    
      const reset = query(conn, `UPDATE pcm_login SET password = '${password}', password_reset = '0' WHERE id_number = '${username}'`).catch(console.log);;
      if (reset != undefined) {
        res.status(201).send({
          'statusCode': 201,
          'responseBody': {
            'message': 'Success',
          }
        });
      } else {
        res.status(200).send({
          'statusCode': 200,
          'responseBody': {
            'message': 'Failed to change passowrd. Please try again later.',
          }
        });
      }
    } else {
      res.send({
        'statusCode': 401,
        'responseBody': {
          'message': 'Invalid credentials.',
        }
      });
    }
  }else{
    res.send({
      'statusCode': 401,
      'responseBody': {
        'message': 'User account not found.',
      }
    });
  }

  res.end();
});

router.post('/login', async (req, res) => {
  try {
    const conn = await connection(dbConfig);

    if (!conn) {
      return res.status(500).send('Database connection failed.');
    }

    const username = req.body.requestBody.username;
    const password = req.body.requestBody.password;
    var refreshToken = randtoken.uid(256);

    const results = await query(conn, 'SELECT * FROM pcm_login WHERE username = ?', [username]);

    if (results.length === 0) {
      logging('AUTH FAILED: ACCOUNT NOT FOUND for ' + username, 'LOGIN', 'Warn');
      res.status(401).send({
        'success': false,
        'message': 'User account not found.',
        'responseBody': {
          'message': 'User account not found.'
        }
      });
      return;
    }

    if (cryptr.decrypt(results[0].password) !== password) {
      logging('AUTH FAILED: INCORRECT CREDENTIALS for ' + username, 'LOGIN', 'Warn');
      res.status(401).send({
        'success': false,
        'message': 'Incorrect Credentials.',
        'responseBody': {
          'message': 'Incorrect Credentials.',
        }
      });
      return;
    }

    if (results[0].password_reset === '1') {
      logging('AUTH FAILED: PASSWORD RESET for ' + username, 'LOGIN', 'Warn');
      res.status(401).send({
        'success': false,
        'message': 'Reset Password',
        'responseBody': {
          'message': 'Reset Password'
        }
      });
      return;
    }

    const userDet = await query(conn, `SELECT * FROM pcm_user WHERE phone_number = '${username}'`);

    const user = {
      'fullName': userDet[0].first_name + " " + userDet[0].surname,
      'role': userDet[0].role,
    };

    const token = jwt.sign(user, SECRET, {
      expiresIn: 10
    });

   refreshToken = randtoken.uid(256);

    refreshTokens[refreshToken] = username;

    logging('AUTH SUCCESS: ' + username, 'LOGIN', 'Success');
    res.status(200).json({
      'success': true,
      'message': 'Success',
      'responseBody': {
        'message': 'Success',
        'username': username,
        'fullName': userDet[0].first_name + " " + userDet[0].surname,
        'email': userDet[0].email_address ,
        'phoneNumber': userDet[0].phone_number,
        'role': userDet[0].role,
        'jwt': token,
        'refreshToken': refreshToken
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
});


router.post('/logout', function (req, res) {
  const refreshToken = req.body.requestBody.refreshToken;
  if (refreshToken in refreshTokens) {
    delete refreshTokens[refreshToken];
  }
  res.sendStatus(204);
});

router.post('/refresh', function (req, res) {
  const refreshToken = req.body.requestBody.refreshToken;
  if (refreshToken in refreshTokens) {
    const user = {
      'username': refreshTokens[refreshToken],
      'role': 'admin'
    }
    const token = jwt.sign(user, SECRET, {
      expiresIn: 600
    });
    res.json({
      jwt: token
    })
  } else {
    res.sendStatus(401);
  }
});

router.get('/random', passport.authenticate('jwt'), function (req, res) {
  res.json({
    value: Math.floor(Math.random() * 100)
  });
});

module.exports = router;