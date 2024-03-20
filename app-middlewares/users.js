const express = require('express');
const connection = require('../helpers/connection');
const query = require('../helpers/query');
const router = express.Router();
const dbConfig = require('../dbConfig');
const { emit } = require('process');
const logging = require('../helpers/logging');


router.post('/beneficiary/save', async (req, res) => {
  const conn = await connection(dbConfig).catch(e => { });

  const billAccount = req.body.requestBody.billAccount;
  const billAccountName = req.body.requestBody.billAccountName;
  const phoneNumber = req.body.requestBody.phoneNumber;

  const checkBeneficiary = await query(conn, `SELECT * FROM pcm_beneficiaries WHERE bill_account = '${billAccount}' And phone_number='${phoneNumber}'`);

  if (checkBeneficiary.length == 0) {
      const beneficiary = await query(conn, `INSERT INTO pcm_beneficiaries (bill_account, account_name, phone_number) VALUES (?,?,?)`, [billAccount, billAccountName, phoneNumber]);
      if (beneficiary == undefined) {
        logging('BENEFICIARY SAVING FAILED','BENEFICIARY','Error')
        res.status(500).send({
          'success': false,
          'message': 'Failed to save beneficiary',
          'responseBody': {
            'message': 'DB Error'
          }
        });
        res.end();
      } else {
          logging('BENEFICIARY SAVING[ account details: ' + billAccount + ': ' + billAccountName   + ' ]','BENEFICIARY','Success');
          res.status(200).send({
            'success': true,
            'message': 'Beneficiary added successfully',
            'responseBody': {
              "message": 'Success',
              "billAccount": billAccount
            }
          });
          res.end();
        
      }
  } else {
    logging('Beneficiary already exist: \n' + JSON.stringify(checkBeneficiary) + ' \n','BENEFICIARY','Warn')
    res.status(200).send({
      'success': false,
      'message': 'BENEFICIARY ALREADY EXISTS',
      'responseBody': {
        'message': 'BENEFICIARY ALREADY EXISTS'
      }
    });
  }
  res.end();
});


// Get all users
router.get('/beneficiary/:username', async (req, res) => {
  const username = req.params.username;
  const conn = await connection(dbConfig).catch(e => { });
  const results = await query(conn, `SELECT * FROM pcm_beneficiaries WHERE phone_number=${username}`).catch(()=>{console.log; return []});
  console.log('\npcm-be - ' + Date() + ' > --------------| Returned All Beneficiaries |---------------');

  res.status(200).send({
    'success': true,
    'message': 'Beneficiaries retrieved',
    'responseBody': {
      'beneficiaries': results
    }
  });

});


router.delete('/beneficiary/:username/:account', async (req, res) => {
  const username = req.params.username;
  const account = req.params.account;
  const conn = await connection(dbConfig).catch(e => { });
  const results = await query(conn, `DELETE FROM pcm_beneficiaries WHERE phone_number='${username}' and bill_account='${account}'`).catch(console.log);

  console.log('\npcm-be - ' + Date() + ' > --------------| Returned All Beneficiaries |---------------');

  res.status(200).send({
    'success': true,
    'message': 'Beneficiary deleted successfully',
    'responseBody': {
      'beneficiaries': results
    }
  });

});

module.exports = router;