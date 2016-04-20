import express from 'express'
import bodyParser from 'body-parser'
import GithubAPI from 'github'

const {GITHUB_TOKEN, GITHUB_REPO, GITHUB_ORG, URL} = process.env

const config = {
  approvalStrings: ['👍'],
  disapprovalStrings: ['👎']
}

var headers = {
  'user-agent': 'approve-ci-bot'
}

var gh = new GithubAPI({
  version: '3.0.0',
  debug: true,
  protocol: 'https',
  host: 'api.github.com',
  pathPrefix: '',
  timeout: 5000,
  headers: headers
})

gh.authenticate({
  type: 'oauth',
  token: GITHUB_TOKEN
})

gh.repos.getHooks({
  user: GITHUB_ORG,
  repo: GITHUB_REPO,
  headers: headers
}, (err, response) => {
  if (err) console.error(err)

  // Existing hook?
  if (response) {
    var hook = response.find((hook) => {
      return (hook.config.url === URL)
    })
    if (hook) {
      return
    }
  }

  // Create a hook
  gh.repos.createHook({
    user: GITHUB_ORG,
    repo: GITHUB_REPO,
    name: 'web',
    active: true,
    config: {
      url: URL,
      content_type: 'json'
    },
    events: ['pull_request', 'issue_comment'],
    headers: headers
  }, (err, response) => {
    if (err) return console.error(err)
    console.log(response)
  })
})

const app = express()
app.use(bodyParser.json())

// Default app-alive message
app.get('/', (req, res) => {
  res.send('Hello, world!')
})

// Handler hook event
app.post('/', (req, res) => {
  var event = req.body

  // Pull Request
  switch (event.action) {
    case 'opened':
    case 'reopened':
    case 'synchronize':
      // Set status to 'pending'
      gh.statuses.create({
        user: GITHUB_ORG,
        repo: GITHUB_REPO,
        sha: event.pull_request.head.sha,
        state: 'pending',
        description: 'Waiting for approval',
        headers: headers
      }, (err, response) => {
        if (err) console.error(err)
        console.log(response)
      })
      break
  }

  // Issue Comment
  switch (event.action) {
    case 'created':
    case 'edited':
      // Fetch all comments from PR
      break

    default:
      console.log('Unknown comment action')
  }
})

// Start server
app.set('port', process.env.PORT || 3000)

app.listen(app.get('port'), () => {
  console.log('Listening on port', app.get('port'))
})
