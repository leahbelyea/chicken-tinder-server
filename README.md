# Chicken Tinder (server)

## Pre-reqs to run locally:
- Install nodemon globally
- create `.env` file in project root, with `YELP_API_KEY=<your yelp api key>`
- `yarn`

## Run app locally:
`nodemon app.js`

## Run the project on AWS
- `pm2 start app.js` start app
- `pm2 startup` restart pm2 when server restarts
- `pm2 save` restart app when pm2 restarts

## Update code on AWS
- `pm2 stop app.js` stop app
- Remove old code
- `git clone https://github.com/leahbelyea/chicken-tinder-server.git`
- `yarn`
- restart as above
