'use strict';

// Users who use the settour command when a tournament is already
// scheduled will be added here and prompted to reuse the command.
// This prevents accidentally overwriting a scheduled tournament.
/**@type {Map<string, string>} */
let overwriteWarnings = new Map();

Tools.Formats = require("./data/pokemon.js").BattleFormatsData;
Tools.Pokedex = require("./data/pokedex.js").BattlePokedex;
Tools.helpEntries = require("./help.js").help;
Tools.Movedex = require("./data/moves.js").BattleMovedex;

/**@type {{[k: string]: Command | string}} */
let commands = {
	// Developer commands
	js: 'eval',
	eval: function (target, room, user) {
		if (!user.isDeveloper()) return;
		try {
			target = eval(target);
			this.say(JSON.stringify(target));
		} catch (e) {
			this.say(e.name + ": " + e.message);
		}
	},

	// General commands
	about: function (target, room, user) {
		if (!(room instanceof Users.User) && !user.hasRank(room, '+')) return;
		this.say(Config.username + " code by sirDonovan: https://github.com/sirDonovan/Cassius");
	},
	mail: function (target, room, user) {
		if (!(room instanceof Users.User) || !Config.allowMail) return;
		let targets = target.split(',');
		if (targets.length < 2) return this.say("Please use the following format: .mail user, message");
		let to = Tools.toId(targets[0]);
		if (!to || to.length > 18 || to === Users.self.id || to.startsWith('guest')) return this.say("Please enter a valid username");
		let message = targets.slice(1).join(',').trim();
		let id = Tools.toId(message);
		if (!id) return this.say("Please include a message to send.");
		if (message.length > (258 - user.name.length)) return this.say("Your message is too long.");
		let database = Storage.getDatabase('global');
		if (to in database.mail) {
			let queued = 0;
			for (let i = 0, len = database.mail[to].length; i < len; i++) {
				if (Tools.toId(database.mail[to][i].from) === user.id) queued++;
			}
			if (queued >= 3) return this.say("You have too many messages queued for " + targets[0] + ".");
		} else {
			database.mail[to] = [];
		}
		database.mail[to].push({time: Date.now(), from: user.name, text: message});
		Storage.exportDatabase('global');
		this.say("Your message has been sent to " + targets[0] + "!");
	},

	// Game commands
	signups: 'creategame',
	creategame: function (target, room, user) {
		if (room instanceof Users.User) return;
		if (!user.hasRank(room, '+')) return;
		if (!Config.games || !Config.games.includes(room.id)) return this.say("Games are not enabled for this room.");
		let format = Games.getFormat(target);
		if (!format || format.inheritOnly) return this.say("The game '" + target + "' was not found.");
		if (format.internal) return this.say(format.name + " cannot be started manually.");
		Games.createGame(format, room);
		if (!room.game) return;
		room.game.signups();
	},
	start: 'startgame',
	startgame: function (target, room, user) {
		if (!(room instanceof Users.User) && !user.hasRank(room, '+')) return;
		if (room.game) room.game.start();
	},
	cap: 'capgame',
	capgame: function (target, room, user) {
		if (room instanceof Users.User || !room.game || !user.hasRank(room, '+')) return;
		let cap = parseInt(target);
		if (isNaN(cap)) return this.say("Please enter a valid player cap.");
		if (cap < room.game.minPlayers) return this.say(room.game.name + " must have at least " + room.game.minPlayers + " players.");
		if (room.game.maxPlayers && cap > room.game.maxPlayers) return this.say(room.game.name + " cannot have more than " + room.game.maxPlayers + " players.");
		room.game.playerCap = cap;
		this.say("The game will automatically start at **" + cap + "** players!");
	},
	end: 'endgame',
	endgame: function (target, room, user) {
		if (!(room instanceof Users.User) && !user.hasRank(room, '+')) return;
		if (room.game) room.game.forceEnd();
	},
	join: 'joingame',
	joingame: function (target, room, user) {
		if (room instanceof Users.User || !room.game) return;
		room.game.join(user);
	},
	leave: 'leavegame',
	leavegame: function (target, room, user) {
		if (room instanceof Users.User || !room.game) return;
		room.game.leave(user);
	},

	// Storage commands
	bits: 'points',
	points: function (target, room, user) {
		if (room !== user) return;
		let targetUserid = target ? Tools.toId(target) : user.id;
		/**@type {Array<string>} */
		let points = [];
		user.rooms.forEach((rank, room) => {
			if (!(room.id in Storage.databases) || !('leaderboard' in Storage.databases[room.id])) return;
			if (targetUserid in Storage.databases[room.id].leaderboard) points.push("**" + room.id + "**: " + Storage.databases[room.id].leaderboard[targetUserid].points);
		});
		if (!points.length) return this.say((target ? target.trim() + " does not" : "You do not") + " have points on any leaderboard.");
		this.say(points.join(" | "));
	},

	// Tournament commands
	tour: 'tournament',
	tournament: function (target, room, user) {
		if (room instanceof Users.User || !Config.tournaments || !Config.tournaments.includes(room.id)) return;
		if (!target) {
			if (!user.hasRank(room, '+')) return;
			if (!room.tour) return this.say("I am not currently tracking a tournament in this room.");
			let info = "``" + room.tour.name + " tournament info``";
			if (room.tour.startTime) {
				return this.say(info + ": **Time**: " + Tools.toDurationString(Date.now() - room.tour.startTime) + " | **Remaining players**: " + room.tour.getRemainingPlayerCount() + '/' + room.tour.totalPlayers);
			} else if (room.tour.started) {
				return this.say(info + ": **Remaining players**: " + room.tour.getRemainingPlayerCount() + '/' + room.tour.totalPlayers);
			} else {
				return this.say(info + ": " + room.tour.playerCount + " player" + (room.tour.playerCount > 1 ? "s" : ""));
			}
		} else {
			if (!user.hasRank(room, '%')) return;
			let targets = target.split(',');
			let cmd = Tools.toId(targets[0]);
			let format;
			switch (cmd) {
			case 'end':
				this.say("/tour end");
				break;
			case 'start':
				this.say("/tour start");
				break;
			default:
				format = Tools.getFormat(cmd);
				if (!format) return this.say('**Error:** invalid format.');
				if (!format.playable) return this.say(format.name + " cannot be played, please choose another format.");
				let cap;
				if (targets[1]) {
					cap = parseInt(Tools.toId(targets[1]));
					if (cap < 2 || cap > Tournaments.maxCap || isNaN(cap)) return this.say("**Error:** invalid participant cap.");
				}
				this.say("/tour new " + format.id + ", elimination, " + (cap ? cap + ", " : "") + (targets.length > 2 ? ", " + targets.slice(2).join(", ") : ""));
			}
		}
	},
	settour: 'settournament',
	settournament: function (target, room, user) {
		if (room instanceof Users.User || !Config.tournaments || !Config.tournaments.includes(room.id) || !user.hasRank(room, '%')) return;
		if (room.id in Tournaments.tournamentTimers) {
			let warned = overwriteWarnings.has(room.id) && overwriteWarnings.get(room.id) === user.id;
			if (!warned) {
				overwriteWarnings.set(room.id, user.id);
				return this.say("A tournament has already been scheduled in this room. To overwrite it, please reuse this command.");
			}
			overwriteWarnings.delete(room.id);
		}
		let targets = target.split(',');
		if (targets.length < 2) return this.say(Config.commandCharacter + "settour - tier, time, cap (optional)");
		let format = Tools.getFormat(targets[0]);
		if (!format) return this.say('**Error:** invalid format.');
		if (!format.playable) return this.say(format.name + " cannot be played, please choose another format.");
		let date = new Date();
		let currentTime = (date.getHours() * 60 * 60 * 1000) + (date.getMinutes() * (60 * 1000)) + (date.getSeconds() * 1000) + date.getMilliseconds();
		let targetTime = 0;
		if (targets[1].includes(':')) {
			let parts = targets[1].split(':');
			let hours = parseInt(parts[0]);
			let minutes = parseInt(parts[1]);
			if (isNaN(hours) || isNaN(minutes)) return this.say("Please enter a valid time.");
			targetTime = (hours * 60 * 60 * 1000) + (minutes * (60 * 1000));
		} else {
			let hours = parseFloat(targets[1]);
			if (isNaN(hours)) return this.say("Please enter a valid time.");
			targetTime = currentTime + (hours * 60 * 60 * 1000);
		}
		let timer = targetTime - currentTime;
		if (timer <= 0) timer += 24 * 60 * 60 * 1000;
		Tournaments.setTournamentTimer(room, timer, format.id, targets[2] ? parseInt(targets[2]) : 0);
		this.say("The " + format.name + " tournament is scheduled for " + Tools.toDurationString(timer) + ".");
	},
	canceltour: 'canceltournament',
	canceltournament: function (target, room, user) {
		if (room instanceof Users.User || !Config.tournaments || !Config.tournaments.includes(room.id) || !user.hasRank(room, '%')) return;
		if (!(room.id in Tournaments.tournamentTimers)) return this.say("There is no tournament scheduled for this room.");
		clearTimeout(Tournaments.tournamentTimers[room.id]);
		this.say("The scheduled tournament was canceled.");
	},
	addchar: function(target, room, user) {
        if (!this.can("set") || !room) return false;
        if (target.length !== 1 || toId(target) || target === " ") return this.send("The command character has to be 1 character long, and cannot be an alphanumeric character.");
        if(room.commandCharacter.includes(target)) return this.send("This is already a command character in this room.")
        room.addCommandCharacter(target);
        this.send(target + " has been added to this room's command characters.");
    },
    setchar: function(target, room, user) {
        if (!this.can("set") || !room) return false;
        if (target.length !== 1 || toId(target) || target === " ") return this.send("The command character has to be 1 character long, and cannot be an alphanumeric character.");
        room.commandCharacter = [];
        room.addCommandCharacter(target);
        this.send(target + " is set as this room's command character.");
    },
    deletechar: function(target, room, user) {
        if (!this.can("set") || !room) return false;
        if (target.length !== 1 || toId(target) || target === " ") return this.send("The command character has to be 1 character long, and cannot be an alphanumeric character.");
        if (room.commandCharacter.length === 1) return this.send("You need at least one command character in every room!");
        if (!room.commandCharacter.includes(target)) return this.send("That is not one of the room's command characters!");
        room.removeCommandCharacter(target);
        this.send(target + " has been removed from this room's command characters.");
    },
    setprivate: function(target, room, user) {
        if (!this.can("set") || !room) return false;
        switch (toId(target)) {
            case "on":
                Db("settings").set([room.id, "isPrivate"], true);
                room.isPrivate = true;
                break;
            case "off":
                Db("settings").set([room.id, "isPrivate"], false);
                room.isPrivate = false;
                break;
            default:
                return this.send("This room is currently marked as " + (Db("settings").get([room.id, "isPrivate"], false) ? "private." : "public."));
        }
        return this.send("This room is currently marked as " + (Db("settings").get([room.id, "isPrivate"], false) ? "private." : "public."));
    },
    set: function(target, room, user) {
        if (!this.can("set") && !this.can("addcom")) return false;
        if (!target) return this.parse("/help set");
        let parts = target.replace(/\, /g, ",").split(",");
        if (parts[0] === "mod") {
            if (!this.can("set") || !room) return false; // roomowner only
            if (!parts[1] || !parts[2]) return this.parse("/help set mod");
            parts[2] = parts[2].trim().replace(/^reg$/i, " ");
            if (!Config.modSettings[toId(parts[1])] || (!["on", "off"].includes(parts[2].toLowerCase()) && !(parts[2] in Config.ranks))) return this.parse("/help set mod");
            let modAspect = toId(parts[1]);
            let modSetting = parts[2].toLowerCase();
            Db("settings").set([room.id, "moderation", modAspect], modSetting);
            return this.send("Moderation for " + modAspect + " will be applied to users of rank \"" + modSetting + "\" and below.");
        }
        let targetCommand = toId(parts[0]);
        let mainCommand;
        if(Commands[targetCommand] && !Config.settableCommands[targetCommand] && typeof Commands[targetCommand] === "string"){
            mainCommand = Commands[targetCommand];
        }
        if (Config.settableCommands[mainCommand || targetCommand]) {
            if (!this.can("set") || !room) return false; // roomowner only
            if(mainCommand) targetCommand = mainCommand;
            if (!parts[1]) return this.parse("/help set");
            let targetSetting = parts[1].toLowerCase();
            if (!Config.ranks[targetSetting] && !["on", "off"].includes(targetSetting)) return this.parse("/help set");
            Db("settings").set([room.id, targetCommand], targetSetting);
            return this.send(room.commandCharacter[0] + targetCommand + " is now " + (toId(targetSetting) ? targetSetting.toUpperCase() : "usable by users " + targetSetting + " and above") + ".");
        }
        let roomCCon = Db("customcommands").get([room ? room.id : "global", targetCommand], null);
        if (roomCCon) {
            let customComSetting = parts[1].toLowerCase();
            if (!Config.ranks[customComSetting]) return this.parse("/help set");
            roomCCon.rank = customComSetting;
            Db("customcommands").set([room ? room.id : "global", targetCommand], roomCCon);
            return this.send("Custom command " + (room ? room.commandCharacter[0] : Config.defaultCharacter[0]) + targetCommand + " is now usable by users " + customComSetting + " and above.");
        }
        this.send(room.commandCharacter[0] + targetCommand + " is neither a custom command nor a regular command on the bot that can be set.")
    },
    bw: "banword",
    regexbanword: "banword",
    banword: function(target, room, user, cmd) {
        if (cmd === "regexbanword" ? (!this.can("set") && user.hasBotRank("+")) : !this.can("banword") || !room) return false;
        if (!target) return this.parse("/help " + (cmd === "bw" ? "banword" : cmd));
        target = target.split(",");
        let points = 3;
        let regexBanword = target.slice(0, target.length - 1).join(",");
        if (isNaN(parseInt(target[target.length - 1]))) {
            regexBanword = target.join(",");
        }
        else if (parseInt(target[target.length - 1]) >= 1) {
            points = parseInt(target[target.length - 1]);
        }
        if (cmd !== "regexbanword") {
            regexBanword = Tools.regexify(regexBanword.trim());
        } else {
            // test for evil regex
            if (/(?!\\)\(.*?(?:[^\\])[\*\+\?][^\)]*?(?!\\)\)([\*\+]|\{[0-9]+(\,|\,?[0-9]*?)\})/i.test(regexBanword)) return this.send("Sorry, I cannot accept that as a regexbanword as your banned phrase may contain some [[evil regex]]...");
            // test if it's actually working regex
            try {
                let test = new RegExp(regexBanword);
            } catch (e) {
                return this.errorReply(e.message.substr(0, 28) === 'Invalid regular expression: ' ? e.message : 'Invalid regular expression: /' + regexBanword + '/: ' + e.message);
            }
        }
        if (!regexBanword) return this.parse("/help " + (cmd === "bw" ? "banword" : cmd));
        let banwordExists = Db("settings").get([room.id, "bannedWords", regexBanword], null);
        if (banwordExists) return this.send("That already exists as a banned phrase in this room.");
        Db("settings").set([room.id, "bannedWords", regexBanword], points);
        this.send("The phrase /" + regexBanword + "/i is banned with a point value of " + points + ".");
    },
    unbanword: function(target, room, user) {
        if (!this.can("banword") || !room) return false;
        if (!target) return this.parse("/help unbanword");
        target = target.trim();
        let banwordExists = Db("settings").get([room.id, "bannedWords", target], null);
        if (!banwordExists) {
            target = Tools.regexify(target);
            banwordExists = Db("settings").get([room.id, "bannedWords", target], null);
            if (!banwordExists) {
                return this.send("That's not a banned word in this room!");
            }
        }
        delete Db("settings").object()[room.id].bannedWords[target];
        Db.save();
        this.send("//" + target + "/i has been removed from this room's list of banned words");
    },
    ab: "autoban",
    autoban: function(target, room, user, cmd) {
        if (!this.can("autoban") || !room) return false;
        if (!target) return this.parse("/help autoban");
        target = toId(target);
        if (target.length > 18 || target.length < 1) return this.send("This is not a legal PS username.")
        if (room.userIsBlacklisted(target)) return this.send("This user is already blacklisted.");
        room.blacklistUser(target);
        this.send("/roomban " + target + ", Blacklisted user.");
        this.send("/modnote \"" + target + "\" was added to the blacklist by " + user.name + ".");
        this.send(target + " was successfully added to the blacklist.");
    },
    unab: "unautoban",
    unautoban: function(target, room, user) {
        if (!this.can("autoban") || !room) return false;
        if (!target) return this.parse("/help unautoban");
        target = toId(target);
        if (target.length > 18 || target.length < 1) return this.send("That is not a legal PS username.")
        if (!room.userIsBlacklisted(target)) return this.send("This user is not blacklisted.");
        room.unblacklistUser(target);
        this.send("/roomunban " + target);
        this.send("/modnote \"" + target + "\" was removed from the blacklist by " + user.name + ".");
        this.send(target + " was successfully removed from the blacklist.");
    },
    settings: function(target, room, user) {
        if (!room && !target) return user.sendTo("Please specify the room.");
        let targetRoom = room;
        if (target) {
            if (Rooms.rooms.has(toId(target, true))) {
                targetRoom = Rooms.get(target);
            }
            else {
                if (!room || this.can("settings")) {
                    return user.sendTo("The bot is not in the room you specified.");
                }
                return false;
            }
        }
        if (!user.can("settings", targetRoom)) {
            //not leaking private rooms
            if (targetRoom.isPrivate) return user.sendTo("The bot is not in the room you specified.");
            return false;
        }
        //get list of banned words
        let roomSettings = Db("settings").get(targetRoom.id);
        let nonCommandValues = ["rch", "moderation", "isPrivate", "bannedWords", "roomBlacklist"];

        function buildBannedWords() {
            let buffer = "+----------------------------------+\n" +
                "| BannedWords                      |\n" +
                "+----------------------------------+\n";
            if (roomSettings.bannedWords && Object.keys(roomSettings.bannedWords).length) {
                buffer += Object.keys(roomSettings.bannedWords).map(function(w) {
                    return "| (" + roomSettings.bannedWords[w] + ") " + w + "                              ".slice(w.length + roomSettings.bannedWords[w].toString().length) + "|";
                }).join("\n") + "\n";
            }
            else {
                buffer += "| None!                            |\n";
            }
            buffer += "+----------------------------------+\n\n";
            return buffer;
        }

        function buildBlacklist() {
            let buffer = "+----------------------+\n" +
                "| Blacklisted Users    |\n" +
                "+----------------------+\n";
            if (targetRoom.blacklist && Object.keys(targetRoom.blacklist).length) {
                buffer += Object.keys(targetRoom.blacklist).sort().map(function(w) {
                    return "| - " + w + "                   ".slice(w.length) + "|";
                }).join("\n") + "\n";
            }
            else if (!targetRoom.blacklist || Object.keys(targetRoom.blacklist).length === 0) {
                buffer += "| None!                |\n";
            }
            buffer += "+----------------------+\n\n";
            return buffer;
        }

        function getModerationSettings() {
            let modBuffer = "Moderation Settings: \n" +
                "+-------------------+-----+\n" +
                "| Moderation Aspect |     |\n" +
                "+-------------------+-----+\n";

            modBuffer += Object.keys(Config.modSettings).map(function(aspect) {
                let tSetting = roomSettings.moderation && roomSettings.moderation[aspect] ? roomSettings.moderation[aspect].toUpperCase() : "+";
                return "| " + aspect + "                  ".slice(aspect.length) + "| " + tSetting + "    ".slice(tSetting.length) + "|\n";
            }).join("+ - - - - - - - - - + - - +\n");
            modBuffer += "+-------------------+-----+\n";
            modBuffer += "*NOTE: the bot will moderate users of that rank and lower for each aspect.\n\n";
            return modBuffer;
        }

        function getCommandSettings() {
            let comBuffer = "Command Settings: \n" +
                "+------------------+-----+\n" +
                "| Command          |     |\n" +
                "+------------------+-----+\n";
            let collectCommands = [];
            for (let aspect in roomSettings) {
                if (nonCommandValues.includes(aspect)) continue;
                let tSetting = roomSettings && roomSettings[aspect] ? roomSettings[aspect].toUpperCase() : Config.defaultRank;
                collectCommands.push("|" + aspect + "                  ".slice(aspect.length) + "| " + tSetting + "    ".slice(tSetting.length) + "|\n");
            }
            comBuffer += collectCommands.join("+ - - - - - - - - -+ - - +\n") +
                "+------------------+-----+\n" +
                "*NOTE: Most commands that have not been set require rank " + Config.defaultRank + " to use/broadcast.\n\n";
            return comBuffer;
        }
        let settingsDisplay = "" +
            "Room name: " + targetRoom.name + "\n" +
            "Room ID: " + targetRoom.id + "\n" +
            "Private Room: " + targetRoom.isPrivate + "\n" +
            "Command characters for this room: " + targetRoom.commandCharacter.join(", ") + "\n\n";
        if (roomSettings) {
            settingsDisplay += getModerationSettings() +
                buildBannedWords() +
                buildBlacklist() +
                getCommandSettings();
        }
        Tools.uploadToHastebin("Settings: \n=========\n\n" + settingsDisplay, function(link) {
            user.sendTo("Settings for " + targetRoom.name + ": " + link);
        }.bind(this))
    },
};

module.exports = commands;
