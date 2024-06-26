const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const https = require('https');
const fs = require('fs');

const usersRouter = require('./app-middlewares/users');
const systemRouter = require('./app-middlewares/system');
const authRouter = require('./app-middlewares/auth');

const pcmRouter = require('./app-middlewares/qr');

const port = 3000;
const app = express();

var cors = require('cors');

app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(cors());

app.get('', (req, res) => {
  console.log("PCM Connected"); res.send('Welcome to PCM Gateway')
});
  
app.use('/pcm/api/auth', authRouter);
app.use('/pcm/api/users', usersRouter);
app.use('/pcm/api/system', systemRouter);
app.use('/pcm/api/qr', pcmRouter);





// const options = {
//   key: fs.readFileSync('./certs/pcm.co.zw.key'),
//   cert: fs.readFileSync('./certs/pcm.pem')
// };



app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT} OR 3000`);
});

// https.createServer(options, app).listen(port);
