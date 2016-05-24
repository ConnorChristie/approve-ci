import express from 'express'
import bodyParser from 'body-parser'

import {getHooks, createHook, getConfig, setState,
  getComments, getPullRequest} from './githubWrapper'
import {testIfHookAlreadyExist, checkApproved, mergeConfigs} from './approval'

const {GITHUB_TOKEN, GITHUB_REPO, GITHUB_ORG, URL} = process.env

if (!GITHUB_TOKEN || !GITHUB_REPO || !GITHUB_ORG || !URL) {
  console.error('The ci was started without env variables')
  console.error('To get started:')
  if (!GITHUB_TOKEN) {
    console.error('* Visit https://github.com/settings/tokens')
    console.error('* Create a new token with the repo rights')
  }
  console.error('* Run the following command:')
  console.error('GITHUB_TOKEN=insert_github_token_here GITHUB_REPO=insert_github_repo_here GITHUB_ORG=insert_github_username_here URL=insert_url_here npm start')
  process.exit(1)
}

// Existing hook?
// If not, create one
getHooks()
  .then(testIfHookAlreadyExist)
  .then(createHook)
  .catch((err) => console.log(err))

const app = express()
app.use(bodyParser.json())

// Default app-alive message
app.get('/', (req, res) => {
  res.send('Hello, world!')
})

// Handler hook event
app.post('/', (req, res) => {
  var event = req.body
  console.log(event)

  // Pull Request
  switch (event.action) {
    case 'opened':
    case 'reopened':
    case 'synchronize':
      // Set status to 'pending'
      const user = event.repository.owner.login
      const repo = event.repository.name
      return getConfig(user, repo).then(mergeConfigs).then((config) => {
        return setState({
          user,
          repo,
          sha: event.pull_request.head.sha,
          name: config.name,
          state: 'pending',
          description: config.pendingString,
          approvalLeft: config.approvalCount
        })
      }).then((response) => {
        res.status(200).send({success: true})
      }).catch((err) => res.status(500).send(err))
  }

  // Issue Comment
  switch (event.action) {
    case 'created':
    case 'edited':
    case 'deleted':
      // Fetch all comments from PR
      if ((event.issue || {}).pull_request) { // check if it's a comment on a PR
        const user = event.repository.owner.login
        const repo = event.repository.name
        return Promise.all([
          getConfig(user, repo),
          getComments(event.issue.number, user, repo),
          getPullRequest(event.issue.number, user, repo)
        ]).then(checkApproved)
          .then((result) => setState({
            ...result,
            user,
            repo
          }))
          .then((response) => {
            res.status(200).send({success: true})
          })
          .catch((err) => res.status(500).send(err))
      }
  }
  return res.status(200).send({success: true})
})

// Start server
app.set('port', process.env.PORT || 3000)

app.listen(app.get('port'), () => {
  console.log('Listening on port', app.get('port'))
})
