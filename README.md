# Tesla
Pokemon Showdown Bot

  [1]: https://github.com/Zarel/Pokemon-Showdown

## Installation
Tesla requires [Node.js][2] version 7.0.0 or later and a command line (e.g. `Command Prompt` on Windows or `Terminal` on Mac OS/Linux) to run. Once you have compatible software, complete installation by following these steps:

1. Cloning a copy of Tesla

  You can do this through the [GitHub client][3] by clicking the "Clone or download" button on the home page of the repository and then clicking "Open in Desktop". You can also use the following [Git][4] command:
  
  `git clone https://github.com/HiTechFlufi/Tesla.git`

  [2]: https://nodejs.org/
  [3]: https://desktop.github.com/
  [4]: https://git-scm.com/

2. Navigate to the root directory

  The remaining steps will take place in the root directory of your Tesla files. Navigate there with the command:

  `cd DIRECTORY`
  
  Replace `DIRECTORY` with the filepath to your directory (e.g. `C:\Users\HiTechFlufi\Documents\GitHub\Tesla`).

3. Install dependencies

  Run the following command to install required dependencies:

  `npm install --production`

  If you plan to contribute to development, run the command without the `--production` flag to also install dependencies used for testing.

4. Set up the config file

  Copy and paste the `config-example.js` file, rename it to `config.js`, and open it in your text editor to enter your desired information.

From this point on, you can start the bot by running the following command:

  `node app.js`

## Development

  The community is allowed to open issues and create pull requests for Tesla to assist in development. Before submitting a pull request, be sure that you have installed development dependencies and ran `npm test` in the terminal to check for errors in your code.

#### Credits

  * Zach Hartin ([@HiTechFlufi][5]) - Primary Developer
  * [Pokemon Showdown][1] - In-game data files, Tools module, and various helper functions
  * Quinton Lee ([@sirDonovan][6]) - Base/Starting Code from Cassius

[5]: https://github.com/HiTechFlufi
[6]: https://github.com/sirDonovan

## License

  Tesla is distributed under the terms of the [MIT License][7].

  [7]: https://github.com/HiTechFlufi/Tesla/blob/master/LICENSE
