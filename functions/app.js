const express = require("express");
const serverless = require("serverless-http");
require('dotenv').config();
const cors = require('cors')
const axios = require('axios')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')

const app = express();
const router = express.Router();

const config = {
    clientId: process.env.YAHOO_CLIENT_ID,
    clientSecret: process.env.YAHOO_CLIENT_SECRET,
    header: process.env.YAHOO_HEADER,
    authUrl: 'https://api.login.yahoo.com/oauth2/request_auth',
    tokenUrl: 'https://api.login.yahoo.com/oauth2/get_token',
    redirectUrl: process.env.REDIRECT_URL,
    clientUrl: process.env.CLIENT_URL,
    tokenExpiration: 3600,
    fantasyUrl: 'https://fantasysports.yahooapis.com',
}

const authParams = `client_id=${config.clientId}&redirect_uri=${config.redirectUrl}&response_type=code&scope=fspt-w`;

const getTokenParams = (code) => {
    return `client_id=${config.clientId}&code=${code}&grant_type=authorization_code&redirect_uri=oob`;
}

// Resolve CORS
app.use(
    // TODO FIX THIS TO ACTUALLY ONLY WORK FOR OUR DOMAIN
    // When your server responds to the request, include the CORS headers specifying the origin from where the request is coming. If you don't care about the origin, specify the * wildcard.
    // The raw response should include a header like this.
    // Access-Control-Allow-Origin: *
    cors({
        origin: [config.clientUrl],
        credentials: true,
    }),
)

// Parse Cookie
app.use(cookieParser())

// Enable netlify deploys
app.use("/.netlify/functions/app", router);

// Verify auth
const auth = (req, res, next) => {
    // try {
    //     const token = req.cookies.token
    //     if (!token) return res.status(401).json({ message: 'Unauthorized' })
    //     jwt.verify(token, config.tokenSecret)
    //     return next()
    // } catch (err) {
    //     console.error('Error: ', err)
    //     res.status(401).json({ message: 'Unauthorized' })
    // }
    try {
        const token = req.header('Authorization')
        if (!token) return res.status(401).json({ message: 'Unauthorized' })
        // TODO store active tokens? just confirm one exists and let yahoo handle? nothing??
        // jwt.verify(token, config.tokenSecret)
        return next()
    } catch (err) {
        console.error('Error: ', err)
        res.status(401).json({ message: 'Unauthorized' })
    }
}

router.get('/auth/url', (_, res) => {
    res.json({
        url: `${config.authUrl}?${authParams}`,
    })
})

router.get('/auth/token', async (req, res) => {
    const { code } = req.query
    if (!code) return res.status(400).json({ message: 'Authorization code must be provided' })
    try {
        const tokenParam = getTokenParams(code)
        const {
            data: { access_token, refresh_token },
        } = await axios.post(config.tokenUrl, tokenParam, {
            headers: {
                'Authorization': config.header,
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        })
        if (!access_token) return res.status(400).json({ message: 'Auth error' })

        res.cookie('refresh_token', refresh_token, { maxAge: config.tokenExpiration, httpOnly: true })
        res.json({
            access_token,
        })
    } catch (err) {
        console.error('Error: ', err)
        res.status(500).json({ message: err.message || 'Server error' })
    }
})

// TODO examine + test/verify it works
// router.get('/auth/logged_in', (req, res) => {
//     try {
//         const token = req.cookies.token
//         if (!token) return res.json({ loggedIn: false })
//
//         const { user } = jwt.verify(token, config.tokenSecret)
//         const newToken = jwt.sign({ user }, config.tokenSecret, { expiresIn: config.tokenExpiration })
//
//         res.cookie('refresh_token', newToken, { maxAge: config.tokenExpiration, httpOnly: true })
//         res.json({ loggedIn: true, user })
//     } catch (err) {
//         res.json({ loggedIn: false })
//     }
// })

// TODO examine + test/verify it works
// router.post('/auth/logout', (_, res) => {
//     // clear cookie
//     res.clearCookie('refresh_token').json({ message: 'Logged out' })
// })


// USER DATA
const parseTeamData = (data) => {
    const teamsArray = [];
    let teamCount = data.fantasy_content.users[0].user[1].games[0].game[1].teams.count;
    let teams = data.fantasy_content.users[0].user[1].games[0].game[1].teams;

    for(let i = 0; i < teamCount; i++){
        const leagueId = teams[i].team[0][0].team_key.split('.')[2];
        const teamData = {
            leagueId: leagueId,
            name: teams[i].team[0][2].name,
            imageUrl: teams[i].team[0][5].team_logos[0].team_logo.url,
        }
        teamsArray.push(teamData);
    }

    return teamsArray;
}

router.get('/teams', async (req, res) => {
    try {
        const access_token = req.header('Authorization');
        const { data }  = await axios.get(`${config.fantasyUrl}/fantasy/v2/users;use_login=1/games;game_keys=nfl/teams?format=json`,
            {
                headers: { Authorization: access_token }
            })
        res.json( parseTeamData(data) )
    } catch (err) {
        console.error('Error: ', err)
    }
})

// PLAYER DATA FOR SPECIFIC LEAGUE
const getFreeAgentData = async (access_token) => {
    const playerArray = [];
    let start = 0;
    let foundAllPlayers = false;

    while (foundAllPlayers === false) {
        const { data }  = await axios.get(`${config.fantasyUrl}/fantasy/v2/league/423.l.32851/players;status=A;sort=AR;start=${start};count=25?format=json`,
            {
                headers: { Authorization: access_token }
            })

        let playerCount = data.fantasy_content.league[1].players.count;
        let players = data.fantasy_content.league[1].players;

        for(let i = 0; i < playerCount; i++){
            const playerData = {
                player_key: players[i].player[0][0].player_key, //761 total
                player_id: players[i].player[0][1].player_id,
                first: players[i].player[0][2].name.first,
                last: players[i].player[0][2].name.last,
                full: players[i].player[0][2].name.full,
                player_link: players[i].player[0][3].url,
                team: players[i].player[0][7].editorial_team_abbr ?? players[i].player[0][8].editorial_team_abbr ?? players[i].player[0][9].editorial_team_abbr,
                player_image: players[i].player[0][13].image_url ?? players[i].player[0][14].image_url ?? players[i].player[0][15].image_url,
                primary_position: players[i].player[0][16].primary_position ?? players[i].player[0][17].primary_position ?? players[i].player[0][18].primary_position,
            }
            playerArray.push(playerData);
        }

        if (playerCount < 25 || players.length === 0) foundAllPlayers = true;
        else start += 25;
    }

    return playerArray;
}

router.get('/players/free-agents', async (req, res) => {
    try {
        const access_token = req.header('Authorization');

        const freeAgents = await getFreeAgentData(access_token)
        res.json(freeAgents)
    } catch (err) {
        console.error('Error: ', err)
    }
})

// TODO dynamically get key for current nfl season, for now hardcoded to 423 = 2023 season
// TODO dynamically get league id(s) for logged in user, for now hardcoded to 32851 = setagles
router.get('/league', auth, async (_, res) => {
    try {
        // TODO test call
        const { data } = await axios.get(`${config.fantasyUrl}/fantasy/v2/league/423.l.32851`)
        res.json({ posts: data?.slice(0, 5) })
    } catch (err) {
        console.error('Error: ', err)
    }
})

// TODO find better long-term solution for local testing
//  (need port + app.get/app.listen for local, need serverless export + router.get for prod due to netlify constraints)
// const PORT = process.env.PORT || 3000
// app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`))
module.exports = app;
module.exports.handler = serverless(app);

