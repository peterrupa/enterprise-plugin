'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');

const fs = {
  pathExistsSync: sinon.stub().returns(true),
  removeSync: sinon.spy(),
};
const wrapClean = proxyquire('./wrapClean', {
  'fs-extra': fs,
});

afterAll(() => sinon.resetHistory());

describe('wrapClean', () => {
  it('deletes wrapper files', async () => {
    wrapClean({
      sls: { config: { servicePath: '/service' } },
      state: {
        pathAssets: '/assets',
        functions: {
          func: {
            runtime: 'nodejs8.10',
            entryNew: 's-func',
          },
        },
      },
    });

    expect(fs.pathExistsSync.callCount).to.equal(2);
    expect(fs.removeSync.callCount).to.equal(2);
    expect(fs.pathExistsSync.calledWith('/assets')).to.be.true;
    expect(fs.pathExistsSync.calledWith('/service/s-func.js')).to.be.true;
    expect(fs.removeSync.calledWith('/assets')).to.be.true;
    expect(fs.removeSync.calledWith('/service/s-func.js')).to.be.true;
  });
});
