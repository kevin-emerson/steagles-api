import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import axios from 'axios'
import queryString from 'query-string'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'

const config = {
    clientId: process.env.YAHOO_CLIENT_ID,
    clientSecret: process.env.YAHOO_CLIENT_SECRET,
    header: process.env.YAHOO_HEADER,
    authUrl: 'https://api.login.yahoo.com/oauth2/request_auth',
    tokenUrl: 'https://api.login.yahoo.com/oauth2/get_token',
    redirectUrl: process.env.REDIRECT_URL,
    clientUrl: process.env.CLIENT_URL,
    tokenSecret: process.env.TOKEN_SECRET,
    tokenExpiration: 3600,
    postUrl: 'https://jsonplaceholder.typicode.com/posts', // TODO get generic yahoo fantasy api url
}

const authParams = queryString.stringify({
    client_id: config.clientId,
    redirect_uri: config.redirectUrl,
    response_type: 'code',
})
const getTokenParams = (code) =>
    queryString.stringify({
        client_id: config.clientId,
        code,
        grant_type: 'authorization_code',
        redirect_uri: 'oob',
    })

const app = express()

// Resolve CORS
app.use(
    // TODO FIX THIS TO ACTUALLY ONLY WORK FOR OUR DOMAIN
    // TODO
    //  Backend
    //
    // When your server responds to the request, include the CORS headers specifying the origin from where the request is coming. If you don't care about the origin, specify the * wildcard.
    //
    // The raw response should include a header like this.
    //
    // Access-Control-Allow-Origin: *

cors({
        origin: [config.clientUrl],
        // credentials: true,
    }),
)

// Parse Cookie
app.use(cookieParser())

// Verify auth
const auth = (req, res, next) => {
    try {
        const token = req.cookies.token
        if (!token) return res.status(401).json({ message: 'Unauthorized' })
        jwt.verify(token, config.tokenSecret)
        return next()
    } catch (err) {
        console.error('Error: ', err)
        res.status(401).json({ message: 'Unauthorized' })
    }
}

app.get('/auth/url', (_, res) => {
    res.json({
        url: `${config.authUrl}?${authParams}`,
    })
})

app.get('/auth/token', async (req, res) => {
    const { code } = req.query
    if (!code) return res.status(400).json({ message: 'Authorization code must be provided' })
    try {
        // Get all parameters needed to hit authorization server
        const tokenParam = getTokenParams(code)
        // Exchange authorization code for access token (id token is returned here too)
        const {
            data: { access_token },
        } = await axios.post(config.tokenUrl, tokenParam, {
            headers: {
                'Authorization': config.header,
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        })
        if (!access_token) return res.status(400).json({ message: 'Auth error' })
        // Set cookies for user
        res.cookie('token', access_token, { maxAge: config.tokenExpiration, httpOnly: true })
        // You can choose to store user in a DB instead
        res.json({
            access_token,
        })
    } catch (err) {
        console.error('Error: ', err)
        res.status(500).json({ message: err.message || 'Server error' })
    }
})

// TODO examine + test/verify it works
app.get('/auth/logged_in', (req, res) => {
    try {
        // Get token from cookie
        const token = req.cookies.token
        if (!token) return res.json({ loggedIn: false })
        const { user } = jwt.verify(token, config.tokenSecret)
        const newToken = jwt.sign({ user }, config.tokenSecret, { expiresIn: config.tokenExpiration })
        // Reset token in cookie
        res.cookie('token', newToken, { maxAge: config.tokenExpiration, httpOnly: true })
        res.json({ loggedIn: true, user })
    } catch (err) {
        res.json({ loggedIn: false })
    }
})

// TODO examine + test/verify it works
app.post('/auth/logout', (_, res) => {
    // clear cookie
    res.clearCookie('token').json({ message: 'Logged out' })
})

// TODO this is placeholder for calls 1-N of yahoo data, config.postUrl will be changed to config.yahooFantasyApi base url
app.get('/user/posts', auth, async (_, res) => {
    try {
        const { data } = await axios.get(config.postUrl)
        res.json({ posts: data?.slice(0, 5) })
    } catch (err) {
        console.error('Error: ', err)
    }
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`))
