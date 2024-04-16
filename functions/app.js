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
        // jwt.verify(token, config.tokenSecret)
        return next()
    } catch (err) {
        console.error('Error: ', err.message)
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
        console.error('Error: ', err.message)
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


// TEAM DATA
const parseTeamsData = (data) => {
    const seasonCount = data.fantasy_content.users[0].user[1].games.count;
    const seasonsArray = []

    for(let s = 0; s <seasonCount; s++) {
        let teamsArray = [];
        let teamCount = data.fantasy_content.users[0].user[1].games[s].game[1].teams.count;
        let teams = data.fantasy_content.users[0].user[1].games[s].game[1].teams;

        for(let i = 0; i < teamCount; i++){
            let idArray = teams[i].team[0][0].team_key.split('.')
            let teamData = {
                gameKey: idArray[0],
                leagueId: idArray[2],
                teamId: idArray[4],
                name: teams[i].team[0][2].name,
                imageUrl: teams[i].team[0][5].team_logos[0].team_logo.url,
            }
            teamsArray.push(teamData);
        }

        let seasonData = {
            year: data.fantasy_content.users[0].user[1].games[s].game[0].season,
            gameKey: data.fantasy_content.users[0].user[1].games[s].game[0].game_key,
            teams: teamsArray
        }

        seasonsArray.push(seasonData)
    }


    return seasonsArray.sort((a, b) => (a.year < b.year) ? 1 : -1);
}

router.get('/user/teams', async (req, res) => {
    try {
        const access_token = req.header('Authorization');
        const { data }  = await axios.get(`${config.fantasyUrl}/fantasy/v2/users;use_login=1/games;game_codes=nfl/teams?format=json`,
            {
                headers: { Authorization: access_token }
            })
        res.json( parseTeamsData(data) )
    } catch (err) {
        res.json({error: err.message})
    }
})

// LEAGUE DATA
const parseLeagueData = (data) => {
    const leagueData = {
        leagueId: data.fantasy_content.league[0].league_id,
        name: data.fantasy_content.league[0].name,
        url: data.fantasy_content.league[0].url,
        logo: data.fantasy_content.league[0].logo_url,
        numTeams: data.fantasy_content.league[0].num_teams,
        is_finished: data.fantasy_content.league[0].is_finished,
        renew: data.fantasy_content.league[0].renew,
        renewed: data.fantasy_content.league[0].renewed,
    }

    return leagueData;
}
router.get('/league', async (req, res) => {
    try {
        const access_token = req.header('Authorization');
        const { leagueId, gameKey } = req.query;
        const { data }  = await axios.get(`${config.fantasyUrl}/fantasy/v2/league/${gameKey}.l.${leagueId}?format=json`,
            {
                headers: { Authorization: access_token }
            })
        res.json( parseLeagueData(data) )
    } catch (err) {
        res.json({error: err.message})
    }
})


const getLeagueTeamData = async (access_token, leagueId, gameKey, numTeams) => {
    const teamArray = [];
    let playerArray = [];

    for(let i = 1; i <= numTeams; i++) {
        // TODO potential data from this call: division_id, waiver_priority, faab_balance, number_of_moves, number_of_trades, draft_grade, draft_recap_url, felo_score, felo_tier, roster.is_editable
        const teamData = await axios.get(`${config.fantasyUrl}/fantasy/v2/team/${gameKey}.l.${leagueId}.t.${i}/roster/players?format=json`,
            {
                headers: { Authorization: access_token }
            })

        const playerCount = teamData.data.fantasy_content.team[1].roster["0"].players.count;

        for(let i = 0; i < playerCount; i++) {
            const currentPlayer = teamData.data.fantasy_content.team[1].roster["0"].players[i].player[0]

            playerArray.push(
                {
                    playerKey: currentPlayer[0].player_key,
                    playerId: currentPlayer[1].player_id,
                    name: currentPlayer[2].name.full,
                    team: currentPlayer[7]?.editorial_team_abbr ?? currentPlayer[8]?.editorial_team_abbr ?? currentPlayer[9]?.editorial_team_abbr,
                    imageUrl: currentPlayer[13]?.headshot?.url ?? currentPlayer[14]?.headshot?.url ?? currentPlayer[15]?.headshot?.url,
                    primaryPosition: currentPlayer[16]?.primary_position ?? currentPlayer[17]?.primary_position ?? currentPlayer[18]?.primary_position,
                    selectedPosition: teamData.data.fantasy_content.team[1].roster["0"].players[i].player[1].selected_position[1].position
                }
            )
        }

        teamArray.push({
            teamId: teamData.data.fantasy_content.team[0][1].team_id,
            teamName: teamData.data.fantasy_content.team[0][2].name,
            teamLogo: teamData.data.fantasy_content.team[0][5].team_logos[0].team_logo.url,
            managerId: teamData.data.fantasy_content.team[0][19].managers[0].manager.manager_id,
            managerName: teamData.data.fantasy_content.team[0][19].managers[0].manager.nickname,
            players: playerArray
        })

        playerArray = [];
    }

    return teamArray;
}

router.get('/league/teams', async (req, res) => {
    try {
        const access_token = req.header('Authorization');
        const { leagueId, gameKey, numTeams } = req.query;

        if (numTeams < 1) res.status(400).json({error: 'There are no teams in this league'});

        const leagueTeams = await getLeagueTeamData(access_token, leagueId, gameKey, numTeams)
        res.json(leagueTeams)
    } catch (err) {
        res.json({error: err.message})
    }
})

const getFreeAgentData = async (access_token, leagueId, gameKey) => {
    const playerArray = [];
    let start = 0;
    let foundAllPlayers = false;

    while (foundAllPlayers === false) {
        const { data }  = await axios.get(`${config.fantasyUrl}/fantasy/v2/league/${gameKey}.l.${leagueId}/players;status=A;sort=AR;start=${start};count=25?format=json`,
            {
                headers: { Authorization: access_token }
            })

        let playerCount = data?.fantasy_content?.league[1]?.players?.count;
        let players = data?.fantasy_content?.league[1]?.players;

        for(let i = 0; i < playerCount; i++){
            const playerData = {
                first: players[i]?.player[0][2]?.name?.first,
                last: players[i]?.player[0][2]?.name?.last,
                full: players[i]?.player[0][2]?.name?.full,
                team: players[i]?.player[0][7]?.editorial_team_abbr ?? players[i]?.player[0][8]?.editorial_team_abbr ?? players[i]?.player[0][9]?.editorial_team_abbr,
                primary_position: players[i]?.player[0][16]?.primary_position ?? players[i]?.player[0][17]?.primary_position ?? players[i]?.player[0][18]?.primary_position,
                player_key: players[i]?.player[0][0]?.player_key,
                player_id: players[i]?.player[0][1]?.player_id,
                player_image: players[i]?.player[0][13]?.image_url ?? players[i]?.player[0][14]?.image_url ?? players[i]?.player[0][15]?.image_url,
                player_link: players[i]?.player[0][3]?.url,
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
        const { leagueId, gameKey } = req.query;

        const freeAgents = await getFreeAgentData(access_token, leagueId, gameKey)
        res.json(freeAgents)
    } catch (err) {
        res.json({error: err.message})
    }
})

// TODO find better long-term solution for local testing
//  (need port + app.get/app.listen for local, need serverless export + router.get for prod due to netlify constraints)
// const PORT = process.env.PORT || 3000
// app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`))
module.exports = app;
module.exports.handler = serverless(app);

