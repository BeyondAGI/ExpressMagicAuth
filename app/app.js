const nodeMailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const codes = require('http-status-codes');

const fetch = require('cross-fetch')
const { ApolloClient, InMemoryCache, ApolloProvider, gql, HttpLink } = require('@apollo/client/core');
require('dotenv').config({ path: '../.env' })
const express = require('express')


console.log(process.env);
console.log(process.env.EMAIL_PASSWORD);

const app = express()
const port = 3000

// Generate JWT
const generate = (email) => {
  const date = new Date();
  date.setHours(date.getHours() + 1);
  return jwt.sign({ email, expriation: date }, process.env.JWT_SECRET);
}

// ApolloClient
const apolloClient = new ApolloClient({
  link: new HttpLink({ uri: process.env.GRAPHQL_ENDPOINT, fetch }),
  cache: new InMemoryCache(),
});

// Email Sender
const transporter = nodeMailer.createTransport({
  auth: {
    pass: process.env.EMAIL_PASSWORD,
    user: process.env.EMAIL_LOGIN,
  },
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT || 456,
  secure: false,
})

// Email Template
const emailTemplate = ({ username, link }) => `
  <p><b>Hi ${username}!</b></p>
  <p>Click the link to login to the ONCF High Speed app: <a href="${link}">Magic Link</a></p>
`;


// Login function
const login = (req, res) => {
  const { email, firstName, lastName } = req.query;
  if (!email) {
    return res.status(codes.StatusCodes.BAD_REQUEST).send({ error: 'email is required' });
  }
  const token = generate(email);
  const mailOptions = {
    from: 'nabiltadili@gmail.com',
    html: emailTemplate({ username: `${firstName} ${lastName}`, link: `${process.env.HOST}/account?token=${token}` }),
    subject: 'Reeventy: Magic Auth Link',
    to: email,
  }

  return transporter.sendMail(mailOptions, error => {
    if (error) {
      console.log(error);
      console.log(mailOptions);
      return res.status(codes.StatusCodes.INTERNAL_SERVER_ERROR).send({ error: 'cannot send mail' });
    }
    return res.status(codes.StatusCodes.OK).send({ message: 'mail has been sent' });
  });
}

// Example: http://localhost:3000/magiclink?email=nabiltadili@gmail.com
app.get('/magiclink', (req, res) => {
  const { email } = req.query;
  apolloClient
  .query({ 
    query: gql`
      query GetUser {
        getUser(email: "${email}") {firstName, lastName}
      }
    `,
  })
    .then((result) => {
      console.log(result)
      if (result.data?.getUser?.lastName) {
        const { firstName, lastName, ...other } = result.data?.getUser;
        req.query.firstName = firstName;
        req.query.lastName = lastName;
        login(req, res);
      } else {
        res.send("User doesn't exist")
      }
    });
  
})

// Run server
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
