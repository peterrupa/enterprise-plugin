'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const chalk = require('chalk');

const fs = {
  writeFileSync: sinon.spy(),
  pathExistsSync: sinon.stub().returns(true),
  removeSync: () => {},
  ensureDirSync: () => {},
  copySync: () => {},
  readFile: sinon.stub().resolves('zipcontents'),
};
const addTree = sinon.stub().resolves();
const writeZip = sinon.stub().resolves();
const JSZip = {
  loadAsync: sinon.stub().resolves({
    file: () => {},
  }),
};

const wrap = proxyquire('./wrap', {
  'jszip': JSZip,
  './zipTree': { addTree, writeZip },
  'fs-extra': fs,
});
const { version } = require('../package.json');

describe('wrap - wrap', () => {
  afterEach(() => sinon.resetHistory());
  it('wraps copies js sdk & calls wrapper', async () => {
    const log = sinon.spy();

    const ctx = {
      deploymentUid: 'deploymentUid',
      state: {},
      provider: { getStage: () => 'dev' },
      sls: {
        config: { servicePath: 'path' },
        service: {
          service: 'service',
          tenant: 'tenant',
          app: 'app',
          appUid: 'appUid',
          tenantUid: 'tenantUid',
          provider: { stage: 'dev', runtime: 'nodejs8.x' },
          functions: {
            dunc: {
              runtime: 'python3.6',
              handler: 'handlerFile.handlerFunc',
            },
            func: {
              runtime: 'nodejs8.10',
              handler: 'handlerFile.handlerFunc',
            },
            punc: {
              runtime: 'python3.6',
              handler: 'path.to.some.handlerFunc',
            },
            zunc: {
              runtime: 'unsupported6.66',
              handler: 'handlerFile.handlerFunc',
            },
          },
        },
        cli: { log },
      },
    };
    await wrap(ctx);

    expect(fs.pathExistsSync.calledWith('path/serverless_sdk')).to.be.true;
    expect(ctx.state.functions).to.deep.equal({
      dunc: {
        entryNew: 's_dunc',
        entryOrig: 'handlerFile',
        extension: 'py',
        handlerNew: 'handler',
        handlerOrig: 'handlerFunc',
        key: 'dunc',
        name: 'service-dev-dunc',
        timeout: 6,
        runtime: 'python3.6',
      },
      func: {
        entryNew: 's_func',
        entryOrig: 'handlerFile',
        extension: 'js',
        handlerNew: 'handler',
        handlerOrig: 'handlerFunc',
        key: 'func',
        name: 'service-dev-func',
        timeout: 6,
        runtime: 'nodejs8.10',
      },
      punc: {
        entryNew: 's_punc',
        entryOrig: 'path.to.some',
        extension: 'py',
        handlerNew: 'handler',
        handlerOrig: 'handlerFunc',
        key: 'punc',
        name: 'service-dev-punc',
        timeout: 6,
        runtime: 'python3.6',
      },
    });
    expect(ctx.sls.service.functions).to.deep.equal({
      dunc: {
        runtime: 'python3.6',
        handler: 's_dunc.handler',
      },
      func: {
        runtime: 'nodejs8.10',
        handler: 's_func.handler',
      },
      punc: {
        runtime: 'python3.6',
        handler: 's_punc.handler',
      },
      zunc: {
        runtime: 'unsupported6.66',
        handler: 'handlerFile.handlerFunc',
      },
    });
    expect(ctx.sls.service.package).to.deep.equal({ include: ['s_*.js', 'serverless_sdk/**'] });
    expect(
      ctx.sls.cli.log.calledWith(
        chalk.keyword('orange')(
          "Warning the Serverless Dashboard doesn't support the following runtime: unsupported6.66"
        )
      )
    ).to.be.true;
    expect(fs.writeFileSync.callCount).to.equal(3);
    expect(
      fs.writeFileSync.calledWith(
        'path/s_func.js',
        `var serverlessSDK = require('./serverless_sdk/index.js')
serverlessSDK = new serverlessSDK({
tenantId: 'tenant',
applicationName: 'app',
appUid: 'appUid',
tenantUid: 'tenantUid',
deploymentUid: 'deploymentUid',
serviceName: 'service',
stageName: 'dev',
pluginVersion: '${version}'})
const handlerWrapperArgs = { functionName: 'service-dev-func', timeout: 6}
try {
  const userHandler = require('./handlerFile.js')
  module.exports.handler = serverlessSDK.handler(userHandler.handlerFunc, handlerWrapperArgs)
} catch (error) {
  module.exports.handler = serverlessSDK.handler(() => { throw error }, handlerWrapperArgs)
}
`
      )
    ).to.be.true;
    expect(fs.writeFileSync.calledWith('path/s_dunc.py')).to.be.true;
  });

  it('wraps copies js sdk & calls wrapper when using an artifact', async () => {
    const log = sinon.spy();

    const ctx = {
      deploymentUid: 'deploymentUid',
      state: {},
      provider: { getStage: () => 'dev' },
      sls: {
        config: { servicePath: 'path' },
        service: {
          service: 'service',
          tenant: 'tenant',
          app: 'app',
          appUid: 'appUid',
          tenantUid: 'tenantUid',
          provider: { stage: 'dev', runtime: 'nodejs8.x' },
          functions: {
            func: {
              runtime: 'nodejs8.10',
              handler: 'handlerFile.handlerFunc',
              package: { artifact: 'bundle.zip' },
            },
          },
        },
        cli: { log },
      },
    };
    await wrap(ctx);

    expect(fs.pathExistsSync.calledWith('path/serverless_sdk')).to.be.true;
    expect(ctx.state.functions).to.deep.equal({
      func: {
        entryNew: 's_func',
        entryOrig: 'handlerFile',
        extension: 'js',
        handlerNew: 'handler',
        handlerOrig: 'handlerFunc',
        key: 'func',
        name: 'service-dev-func',
        timeout: 6,
        runtime: 'nodejs8.10',
      },
    });
    expect(ctx.sls.service.functions).to.deep.equal({
      func: {
        runtime: 'nodejs8.10',
        handler: 's_func.handler',
        package: { artifact: 'bundle.zip' },
      },
    });
    expect(ctx.sls.service.package).to.deep.equal({ include: ['s_*.js', 'serverless_sdk/**'] });
    expect(fs.writeFileSync.callCount).to.equal(1);
    expect(
      fs.writeFileSync.calledWith(
        'path/s_func.js',
        `var serverlessSDK = require('./serverless_sdk/index.js')
serverlessSDK = new serverlessSDK({
tenantId: 'tenant',
applicationName: 'app',
appUid: 'appUid',
tenantUid: 'tenantUid',
deploymentUid: 'deploymentUid',
serviceName: 'service',
stageName: 'dev',
pluginVersion: '${version}'})
const handlerWrapperArgs = { functionName: 'service-dev-func', timeout: 6}
try {
  const userHandler = require('./handlerFile.js')
  module.exports.handler = serverlessSDK.handler(userHandler.handlerFunc, handlerWrapperArgs)
} catch (error) {
  module.exports.handler = serverlessSDK.handler(() => { throw error }, handlerWrapperArgs)
}
`
      )
    ).to.be.true;
    expect(fs.readFile.calledWith('bundle.zip')).to.be.true;
    expect(JSZip.loadAsync.calledWith('zipcontents')).to.be.true;
    expect(addTree.args[0][1]).to.equal('serverless_sdk');
    expect(writeZip.args[0][1]).to.equal('bundle.zip');
  });

  it('wraps copies js sdk & calls wrapper with package individually', async () => {
    const log = sinon.spy();

    const ctx = {
      deploymentUid: 'deploymentUid',
      state: {},
      provider: { getStage: () => 'dev' },
      sls: {
        config: { servicePath: 'path' },
        service: {
          package: { individually: true },
          service: 'service',
          tenant: 'tenant',
          app: 'app',
          appUid: 'appUid',
          tenantUid: 'tenantUid',
          provider: { stage: 'dev', runtime: 'nodejs8.x' },
          functions: {
            dunc: {
              runtime: 'python3.6',
              handler: 'handlerFile.handlerFunc',
            },
            func: {
              runtime: 'nodejs8.10',
              handler: 'handlerFile.handlerFunc',
            },
          },
        },
        cli: { log },
      },
    };
    await wrap(ctx);

    expect(fs.pathExistsSync.calledWith('path/serverless_sdk')).to.be.true;
    expect(ctx.state.functions).to.deep.equal({
      dunc: {
        entryNew: 's_dunc',
        entryOrig: 'handlerFile',
        extension: 'py',
        handlerNew: 'handler',
        handlerOrig: 'handlerFunc',
        key: 'dunc',
        name: 'service-dev-dunc',
        timeout: 6,
        runtime: 'python3.6',
      },
      func: {
        entryNew: 's_func',
        entryOrig: 'handlerFile',
        extension: 'js',
        handlerNew: 'handler',
        handlerOrig: 'handlerFunc',
        key: 'func',
        name: 'service-dev-func',
        timeout: 6,
        runtime: 'nodejs8.10',
      },
    });
    expect(ctx.sls.service.functions).to.deep.equal({
      dunc: {
        runtime: 'python3.6',
        handler: 's_dunc.handler',
        package: {
          include: ['s_dunc.py', 'serverless_sdk/**'],
        },
      },
      func: {
        runtime: 'nodejs8.10',
        handler: 's_func.handler',
        package: {
          include: ['s_func.js', 'serverless_sdk/**'],
        },
      },
    });
    expect(ctx.sls.service.package).to.deep.equal({ individually: true });
    expect(fs.writeFileSync.callCount).to.equal(2);
    expect(
      fs.writeFileSync.calledWith(
        'path/s_func.js',
        `var serverlessSDK = require('./serverless_sdk/index.js')
serverlessSDK = new serverlessSDK({
tenantId: 'tenant',
applicationName: 'app',
appUid: 'appUid',
tenantUid: 'tenantUid',
deploymentUid: 'deploymentUid',
serviceName: 'service',
stageName: 'dev',
pluginVersion: '${version}'})
const handlerWrapperArgs = { functionName: 'service-dev-func', timeout: 6}
try {
  const userHandler = require('./handlerFile.js')
  module.exports.handler = serverlessSDK.handler(userHandler.handlerFunc, handlerWrapperArgs)
} catch (error) {
  module.exports.handler = serverlessSDK.handler(() => { throw error }, handlerWrapperArgs)
}
`
      )
    ).to.be.true;
    expect(
      fs.writeFileSync.calledWith(
        'path/s_dunc.py',
        `import serverless_sdk
sdk = serverless_sdk.SDK(
    tenant_id='tenant',
    application_name='app',
    app_uid='appUid',
    tenant_uid='tenantUid',
    deployment_uid='deploymentUid',
    service_name='service',
    stage_name='dev',
    plugin_version='${version}'
)
handler_wrapper_kwargs = {'function_name': 'service-dev-dunc', 'timeout': 6}
try:
    user_handler = serverless_sdk.get_user_handler('handlerFile.handlerFunc')
    handler = sdk.handler(user_handler, **handler_wrapper_kwargs)
except Exception as error:
    e = error
    def error_handler(event, context):
        raise e
    handler = sdk.handler(error_handler, **handler_wrapper_kwargs)
`
      )
    ).to.be.true;
  });
});
