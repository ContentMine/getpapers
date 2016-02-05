# Contributing to getpapers

:+1: Thank you for taking the time to contribute!

This is a set of guidelines for contributing to getpapers. You don't need to follow them as strict rules, use your best judgement and feel free to propose changes to this document as well via a pull request.

#### Table of Contents

[Basics](#basics)

[Code style](#code-style)

[How can I contribute?](#how-can-i-contribute?)

[Local testing](#local-testing)

[Not sure how to get started?](#not-sure-how-to-get-started?)


## Basics

getpapers is based on Node.js. If you want an introduction on how to work on a project like this, you can find a comprehensive tutorial [here](http://www.nodebeginner.org/).
 
## Code style


## How can I contribute?

### Report bugs

If you encounter a bug, please let us know. You can raise a new issue [here](https://github.com/ContentMine/getpapers/issues). Please include as many information in your report as possible, to help maintainers reproduce the problem.

* A clear and descriptive title
* Describe the exact steps which reproduce the problem, e.g. the query you entered.
* Describe the behaviour following those steps, and where the problem occurred.
* Explain where it was different from what you expected to happen.
* Add a `bug` label to the issue.

Before submitting a bug, please check the [list of existing bugs](https://github.com/ContentMine/getpapers/issues?q=is%3Aissue+is%3Aopen+label%3Abug) whether there is a similar issue open. You can then help by adding your information to an existing report.

### Fixing bugs or implementing new features

If you're not sure where to start, have a look at issues that have a `help wanted` label - here is a [list](https://github.com/ContentMine/getpapers/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22).

### Suggesting features or changes

There is always room for improvement and we'd like to hear your perspective on it.

Before creating a pull request, please raise an issue to discuss the proposed changes first. 

## Local testing

In order to set up your development environment for getpapers, you need to install [Node.js](https://nodejs.org/en/).

1. Create a fork on [github](https://help.github.com/articles/fork-a-repo/).

1. Create a [new branch](https://www.atlassian.com/git/tutorials/using-branches/git-checkout) with a descriptive name.

1. Work on your changes, and make regular commits to save them.

1. Test your changes by running `npm install` within the repository and running gepapers with `npm bin/getpapers.js`.

1. When everyhing works and you think your changes are ready, push them to your repository and [create a pull request](https://www.atlassian.com/git/tutorials/making-a-pull-request).

1. We will then review the pull request and merge it as soon as possible. If problems arise, they will be discussed within the pull request.