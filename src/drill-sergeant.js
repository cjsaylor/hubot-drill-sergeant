// Description:
//   Enables knowing what pull requests are stale via Drill Sergeant.
//
// Dependencies:
//   "drill-sergeant": "*"
//   "node-schedule": "*"
//
// Configuration:
//   HUBOT_DRILL_SERGEANT_GITHUB_TOKEN
//   HUBOT_DRILL_SERGEANT_STALE_TIME
//   HUBOT_DRILL_SERGEANT_REPOS
//   HUBOT_DRILL_SERGEANT_SCHEDULE (optional)
//   HUBOT_DRILL_SERGEANT_ROOM (optional)
//
// Commands:
//   hubot what prs are stale? - Shows all pull requests that are stale.
//
// Author:
//   cjsaylor

var githubClient = require('drill-sergeant/lib/github');
var staleRepos = require('drill-sergeant/lib/stalerepos');
var schedule = require('node-schedule');

module.exports = function(robot) {
	var token = process.env.HUBOT_DRILL_SERGEANT_GITHUB_TOKEN;
	var staleTime = process.env.HUBOT_DRILL_SERGEANT_STALE_TIME || 24;
	var repos = (process.env.HUBOT_DRILL_SERGEANT_REPOS || '').split(',');
	var crontab = process.env.HUBOT_DRILL_SERGEANT_SCHEDULE || '10 * * * *';
	var announcementRoom = process.env.HUBOT_DRILL_SERGEANT_ROOM;
	var client;

	// Setup
	if (!token) {
		robot.logger.error('Drill-sergeant: No github token specified.');
		return;
	}
	client = new githubClient(token);
	if (!repos.length) {
		robot.logger.error('Drill-sergeant: No repos specified.');
	}

	var brainCache = function(key, value, expires) {
		robot.brain.set(key, value);
		setTimeout(robot.brain.remove.bind(robot.brain, key), expires || 1000 * 60);
	};

	var broadcastStale = function(sender, staleRepos) {
		var output = [];
		staleRepos.forEach(function(result) {
			output.push('\n' + result.repo + ':\n');
			result.prs.forEach(function(pr) {
				output.push(pr.title + ' (' + pr.user + ') ' + pr.html_url);
			});
		});
		sender(output.join('\n'));
	};

	var retrievePrs = function(callback) {
		var cacheKey = 'drill-sergeant.stalePrs';
		results = robot.brain.get(cacheKey);
		if (results) {
			callback(results);
			return;
		}
		staleRepos.retrieve(repos, client, staleTime, function(results) {
			brainCache(cacheKey, results);
			callback(results);
		});
	};

	// Robot tasks

	robot.respond(/what prs are stale/i, function(msg) {
		retrievePrs(broadcastStale.bind(null, msg.send.bind(msg)));
	});

	if (!announcementRoom) {
		robot.logger.warning('Drill-sergeant: No room specified, therefore not scheduling stale announcements.');
	} else {
		schedule.scheduleJob(crontab, function() {
			retrievePrs(broadcastStale.bind(null, robot.messageRoom.bind(robot, announcementRoom)));
		});
	}
	
};
