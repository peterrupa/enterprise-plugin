'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');

const getLogDestination = sinon.stub().resolves({ destinationArn: 'arn:logdest' });
const logsCollection = proxyquire('./logsCollection', {
  '@serverless/platform-sdk': { getLogDestination, getAccessKeyForTenant: () => 'accessKey' },
});

const { LAMBDA_FILTER_PATTERN, API_GATEWAY_FILTER_PATTERN } = require('./utils');

describe('logsCollection', () => {
  it('adds log subscription filter to template', async () => {
    const log = sinon.spy();
    const request = async () => ({ Account: 'ACCOUNT_ID' });
    const getStage = sinon.stub().returns('dev');
    const getRegion = sinon.stub().returns('us-east-1');
    const getServiceName = sinon.stub().returns('serviceName');
    const ctx = {
      sls: {
        cli: { log },
        service: {
          tenant: 'tenant',
          app: 'app',
          appUid: 'app123',
          tenantUid: 'tenant123',
          custom: { enterprise: { collectLambdaLogs: true } },
          getServiceName,
          provider: {
            compiledCloudFormationTemplate: {
              Resources: {
                lambdaLogs: {
                  Type: 'AWS::Logs::LogGroup',
                  Properties: {
                    LogGroupName: '/aws/lambda/service-name-dev-func',
                  },
                },
                apiGatewayLogs: {
                  Type: 'AWS::Logs::LogGroup',
                  Properties: {
                    LogGroupName: '/aws/api-gateway/service-name-dev',
                  },
                },
              },
            },
          },
        },
      },
      provider: {
        request,
        getStage,
        getRegion,
      },
    };
    const that = { serverless: { classes: { Error } } };
    await logsCollection.bind(that)(ctx);
    expect(log.callCount).to.equal(0);
    expect(getServiceName.callCount).to.equal(1);
    expect(getStage.callCount).to.equal(1);
    expect(getRegion.callCount).to.equal(1);
    expect(getLogDestination.args[0][0]).to.deep.equal({
      accessKey: 'accessKey',
      appUid: 'app123',
      tenantUid: 'tenant123',
      stageName: 'dev',
      serviceName: 'serviceName',
      regionName: 'us-east-1',
      accountId: 'ACCOUNT_ID',
    });
    expect(ctx.sls.service.provider.compiledCloudFormationTemplate).to.deep.equal({
      Resources: {
        lambdaLogs: {
          Type: 'AWS::Logs::LogGroup',
          Properties: {
            LogGroupName: '/aws/lambda/service-name-dev-func',
          },
        },
        apiGatewayLogs: {
          Type: 'AWS::Logs::LogGroup',
          Properties: {
            LogGroupName: '/aws/api-gateway/service-name-dev',
          },
        },
        CloudWatchLogsSubscriptionFilterLambdaLogs: {
          Type: 'AWS::Logs::SubscriptionFilter',
          Properties: {
            DestinationArn: 'arn:logdest',

            FilterPattern: LAMBDA_FILTER_PATTERN,
            LogGroupName: {
              Ref: 'lambdaLogs',
            },
          },
        },
        CloudWatchLogsSubscriptionFilterApiGatewayLogs: {
          Type: 'AWS::Logs::SubscriptionFilter',
          Properties: {
            DestinationArn: 'arn:logdest',
            FilterPattern: API_GATEWAY_FILTER_PATTERN,
            LogGroupName: {
              Ref: 'apiGatewayLogs',
            },
          },
        },
      },
    });
  });
});
