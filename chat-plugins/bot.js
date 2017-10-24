'use strict';
exports.commands = {
    eval: function(target, room, user) {
        if (!user.isDev() || !target) return false;
        let battle;
        if (room && room.battle) {
            battle = room.battle;
        }
        try {
            let result = eval(target.trim());
            this.send("<< " + JSON.stringify(result));
        }
        catch (e) {
            this.send("<< " + e.name + ": " + e.message)
        }
    },
    c: "custom",
    custom: function(target, room, user) {
        if (!user.isDev() || !target) return false;
        if (target.indexOf("[") === 0 && target.indexOf("]") > 1) {
            let targetRoomId = toId(target.split("[")[1].split("]")[0], true);
            if (!Rooms.rooms.has(targetRoomId)) return this.send("I am not in the room you specified.");
            this.room = Rooms.get(target.split("[")[1].split("]")[0]);
            target = target.split("]").slice(1).join("]").trim();
        }
        if (!target) return false;
        this.send(target);
    },
    reload: function(target, room, user) {
        if (!user.isDev()) return false;
        let success = Tools.reload();
        this.send(success ? "Reloaded commands." : "Failed to reload commands.");
    },
    rename: "login",
    login: function(target, room, user) {
        if (!user.isDev()) return false;
        if (!target) {
            log("monitor", "Manually logging in as " + Config.bot.name + " - pass: " + Config.bot.pass);
            this.send("Renaming to " + Config.bot.name);
            Parse.login(Config.bot.name, Config.bot.pass);
            return;
        }
        target = target.split(",");
        let nick = target[0];
        let pass = target.length > 1 ? target.slice(1).join(",").trim() : null;
        log("monitor", "Manually logging in as " + nick + " - pass: " + pass);
        Parse.login(nick, pass);
        this.send("Attempting to rename to " + nick);
    },
    auth: "promote",
    promote: function(target, room, user) {
        if (!target) return this.parse("/botauth");
        if (target.split(",").length !== 2 || !["deauth", "+", "%", "@", "~"].includes(target.split(",")[1].trim())) return false;
        if (!this.can("promote", target.split(",")[1].trim().replace("deauth", " "))) return false;
        let rankNames = {
            "deauth": "Regular",
            "+": "Voice",
            "%": "Driver",
            "@": "Moderator",
            "~": "Administrator",
        }
        if (target.split(",")[1].trim().replace("deauth", " ") === " ") {
            delete Db("ranks").object()[this.targetUser.userid || this.targetUser];
            if(this.targetUser.userid) this.targetUser.botRank = " ";
            Db.save();
        }
        else {
            typeof this.targetUser !== "string" ? this.targetUser.botPromote(target.split(",")[1].trim().replace("deauth", " ")) : Db("ranks").set(toId(this.targetUser), target.split(",")[1].trim().replace("deauth", " "));
        }
        this.send((this.targetUser.name || this.targetUser) + " was appointed Bot " + rankNames[target.split(",")[1].trim()] + ".");
    },
    botauth: function(target, room, user) {
        this.can("say");
        let botAuth = Db("ranks").object();
        let auth = {};
        for (var u in botAuth) {
            if (!auth[botAuth[u]]) auth[botAuth[u]] = [];
            auth[botAuth[u]].push(u);
        }
        let rankNames = {
            "+": "+Voices",
            "%": "%Drivers",
            "@": "@Moderators",
            "~": "~Adminstrators",
        }
        let buffer = Object.keys(auth).sort(function(a, b) {
            if (Config.ranks[a] > Config.ranks[b]) return -1;
            return 1;
        }).map(function(r) {
            return rankNames[r] + " (" + auth[r].length + ")\n" + auth[r].sort().join(", ");
        }).join("\n\n");
        Tools.uploadToHastebin(buffer, function(link) {
            this.send("Bot Auth: " + link);
        }.bind(this))
    },
    mute: function(target, room, user) {
        if (!target || !this.can("mute")) return false;
        if (Monitor.isBanned(this.targetUser.userid || this.targetUser) && ["lock", "ban"].includes(Monitor.isBanned(this.targetUser.userid || this.targetUser))) return this.send("The user is already locked/banned.");
        Monitor.mute(this.targetUser.userid || this.targetUser);
        this.send((this.targetUser.name || this.targetUser) + " was muted from using the bot for 7 minutes by " + user.name + ".");
    },
    lock: function(target, room, user) {
        if (!target || !this.can("lock")) return false;
        if (Monitor.isBanned(this.targetUser.userid || this.targetUser) && Monitor.isBanned(this.targetUser.userid || this.targetUser) === "ban") return this.send("The user is already banned.");
        Monitor.lock(this.targetUser.userid || this.targetUser);
        this.send((this.targetUser.name || this.targetUser) + " was locked from using the bot by " + user.name + ".");
    },
    ban: function(target, room, user) {
        if (!target || !this.can("ban")) return false;
        Monitor.ban(this.targetUser.userid || this.targetUser);
        this.send((this.targetUser.name || this.targetUser) + " was banned from using the bot by " + user.name + ".");
    },
    unmute: function(target, room, user) {
        if (!target || !this.can("mute") || Monitor.isBanned(this.targetUser.userid || this.targetUser) !== "mute") return false;
        Monitor.release(this.targetUser.userid || this.targetUser);
        this.send((this.targetUser.name || this.targetUser) + " was unmuted by " + user.name + ".");
    },
    unlock: function(target, room, user) {
        if (!target || !this.can("lock") || Monitor.isBanned(this.targetUser.userid || this.targetUser) !== "lock") return false;
        Monitor.release(this.targetUser.userid || this.targetUser);
        this.send((this.targetUser.name || this.targetUser) + " was unlocked by " + user.name + ".");
    },
    unban: function(target, room, user) {
        if (!target || !this.can("ban") || Monitor.isBanned(this.targetUser.userid || this.targetUser) !== "ban") return false;
        Monitor.release(this.targetUser.userid || this.targetUser);
        this.send((this.targetUser.name || this.targetUser) + " was unbanned by " + user.name + ".");
    },
};
