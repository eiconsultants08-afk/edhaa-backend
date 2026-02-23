import { config } from '../constants.js';
import { Client as SSHClient } from 'ssh2';

const sshConfig = config.sshConfig;

// Create an SSH tunnel and connect to the RDS database
const connectToRDS = async () => {
  const sshClient = new SSHClient();

  await new Promise((resolve, reject) => {
    sshClient.on("ready", resolve).on("error", reject);
    sshClient.connect(sshConfig);
  });
};

export default connectToRDS;