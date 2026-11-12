const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function appendEnv(file, values) {
  fs.appendFileSync(
    file,
    Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(''),
  );
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required GitHub Actions environment variable: ${name}`);
  }
  return value;
}

function getIntegerInput(name, defaultValue, min, max) {
  const raw = process.env[`INPUT_${name.toUpperCase()}`] || defaultValue;
  if (!/^\d+$/.test(raw)) {
    throw new Error(`Input "${name}" must be an integer.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`Input "${name}" must be between ${min} and ${max}.`);
  }
  return value;
}

function getEmulatorVersion() {
  const version = process.env['INPUT_EMULATOR-VERSION'] || 'latest';
  if (version !== 'latest' && !/^\d+(?:\.\d+){2,3}$/.test(version)) {
    throw new Error('Input "emulator-version" must be "latest" or a dotted numeric version.');
  }
  return version;
}

function getPackageArchitecture() {
  if (process.arch === 'x64') return 'x86_64';
  if (process.arch === 'arm64') return 'aarch64';
  throw new Error(`AWS Emulator packages do not support runner architecture "${process.arch}".`);
}

function checkHealth(url, ca) {
  return new Promise((resolve) => {
    const request = https.get(url, { ca, timeout: 1000 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        resolve(response.statusCode === 200 && body.trim() === 'ok');
      });
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

function isContainerRunning(containerName) {
  try {
    return run('docker', ['inspect', '--format={{.State.Running}}', containerName]).trim() === 'true';
  } catch {
    return false;
  }
}

function containerLogs(containerName) {
  try {
    return run('docker', ['logs', containerName], { stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    return error.stderr ? error.stderr.toString().trim() : error.message;
  }
}

async function waitForReady(containerName, url, caPath, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    if (!isContainerRunning(containerName)) {
      throw new Error(`AWS Emulator container exited before becoming healthy.\n${containerLogs(containerName)}`);
    }

    if (fs.existsSync(caPath) && await checkHealth(url, fs.readFileSync(caPath))) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`AWS Emulator did not become healthy within ${timeoutSeconds} seconds.\n${containerLogs(containerName)}`);
}

async function start() {
  if (process.platform !== 'linux') {
    throw new Error('AWS Emulator GitHub Action requires a Linux runner with Docker.');
  }

  const port = getIntegerInput('port', '9297', 1, 65535);
  const timeoutSeconds = getIntegerInput('startup-timeout', '120', 1, 3600);
  const emulatorVersion = getEmulatorVersion();
  const telemetry = process.env.INPUT_TELEMETRY || 'off';
  if (!['on', 'off'].includes(telemetry)) {
    throw new Error('Input "telemetry" must be "on" or "off".');
  }

  const githubActionPath = getRequiredEnv('GITHUB_ACTION_PATH');
  const runnerTemp = getRequiredEnv('RUNNER_TEMP');
  const outputFile = getRequiredEnv('GITHUB_OUTPUT');
  const envFile = getRequiredEnv('GITHUB_ENV');
  const stateFile = getRequiredEnv('GITHUB_STATE');
  const runnerUid = typeof process.getuid === 'function' ? process.getuid() : null;
  const runnerGid = typeof process.getgid === 'function' ? process.getgid() : null;
  if (runnerUid === null || runnerGid === null) {
    throw new Error('Could not determine the runner user and group for container file access.');
  }
  run('docker', ['info']);

  const id = crypto.randomUUID().replaceAll('-', '');
  const containerName = `aws-emulator-${id.slice(0, 12)}`;
  const imageTag = `aws-emulator-action:${id}`;
  const dataDir = path.join(runnerTemp, containerName);
  const caPath = path.join(dataDir, '.aws', 'emulator', String(port), 'ca.pem');
  const endpointUrl = `https://127.0.0.1:${port}`;
  const configPath = path.join(dataDir, '.aws', 'emulator', String(port), 'config');
  const credentialsPath = path.join(dataDir, '.aws', 'emulator', String(port), 'emulator_credentials');

  appendEnv(stateFile, {
    container_name: containerName,
    image_tag: imageTag,
    data_dir: dataDir,
  });
  fs.mkdirSync(dataDir, { recursive: true });

  run('docker', [
    'build',
    '--pull',
    '--build-arg',
    `EMULATOR_ARCH=${getPackageArchitecture()}`,
    '--build-arg',
    `EMULATOR_VERSION=${emulatorVersion}`,
    '--tag',
    imageTag,
    githubActionPath,
  ], { stdio: 'inherit' });

  run('docker', [
    'run',
    '--detach',
    '--rm',
    '--name',
    containerName,
    '--publish',
    `127.0.0.1:${port}:${port}`,
    '--user',
    `${runnerUid}:${runnerGid}`,
    '--env',
    `HOME=${dataDir}`,
    '--volume',
    `${dataDir}:${dataDir}`,
    imageTag,
    '-p',
    String(port),
    '--telemetry',
    telemetry,
  ], { stdio: 'inherit' });

  await waitForReady(containerName, `${endpointUrl}/__admin/health`, caPath, timeoutSeconds);

  const outputs = {
    endpoint_url: endpointUrl,
    ca_bundle: caPath,
    config_file: configPath,
    credentials_file: credentialsPath,
    container_name: containerName,
  };
  appendEnv(outputFile, outputs);
  appendEnv(envFile, {
    AWS_ENDPOINT_URL: endpointUrl,
    AWS_SHARED_CREDENTIALS_FILE: credentialsPath,
    AWS_CONFIG_FILE: configPath,
    AWS_CA_BUNDLE: caPath,
    AWS_EC2_METADATA_DISABLED: 'true',
    AWS_DISABLE_HOST_PREFIX_INJECTION: 'true',
    AWS_REGION: 'us-east-1',
    AWS_DEFAULT_REGION: 'us-east-1',
  });
  console.log(`AWS Emulator is ready at ${endpointUrl}.`);
}

function stop() {
  const containerName = process.env.STATE_container_name;
  if (!containerName) return;

  run('docker', ['info']);
  if (isContainerRunning(containerName)) {
    run('docker', ['stop', '--timeout', '10', containerName], { stdio: 'inherit' });
  }

  const imageTag = process.env.STATE_image_tag;
  if (imageTag) {
    try {
      run('docker', ['image', 'rm', '--force', imageTag], { stdio: 'inherit' });
    } catch (error) {
      console.warn(`Could not remove AWS Emulator image ${imageTag}: ${error.message}`);
    }
  }

  const dataDir = process.env.STATE_data_dir;
  if (dataDir && path.basename(dataDir) === containerName) {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  console.log(`Stopped AWS Emulator container ${containerName}.`);
}

if (process.env.STATE_container_name) {
  try {
    stop();
  } catch (error) {
    console.error(`Failed to clean up AWS Emulator: ${error.message}`);
    process.exitCode = 1;
  }
} else {
  start().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
