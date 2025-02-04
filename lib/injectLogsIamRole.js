'use strict';

const { getAccessKeyForTenant, getMetadata } = require('@serverless/platform-sdk');
const { entries, values } = require('lodash');

module.exports = async function(ctx) {
  if (
    ctx.sls.service.custom &&
    ctx.sls.service.custom.enterprise &&
    ctx.sls.service.custom.enterprise.collectLambdaLogs === false
  ) {
    return;
  }

  if (
    values(ctx.sls.service.provider.compiledCloudFormationTemplate.Resources).filter(
      ({ Type }) => Type === 'AWS::Logs::LogGroup'
    ).length === 0
  ) {
    // no log groups
    return;
  }

  const accessKey = await getAccessKeyForTenant(ctx.sls.service.tenant);

  if (
    ctx.sls.service.custom &&
    ctx.sls.service.custom.enterprise &&
    ctx.sls.service.custom.enterprise.logAccessIamRole
  ) {
    return;
  }

  const { awsAccountId } = await getMetadata(accessKey);
  ctx.sls.service.provider.compiledCloudFormationTemplate.Resources.EnterpriseLogAccessIamRole = {
    Type: 'AWS::IAM::Role',
    Properties: {
      AssumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              AWS: `arn:aws:iam::${awsAccountId}:root`,
            },
            Action: 'sts:AssumeRole',
            Condition: {
              StringEquals: {
                'sts:ExternalId': `ServerlessEnterprise-${ctx.sls.service.tenantUid}`,
              },
            },
          },
        ],
      },
      Policies: [
        {
          PolicyName: 'LogFilterAccess',
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['logs:FilterLogEvents'],
                Resource: entries(ctx.sls.service.provider.compiledCloudFormationTemplate.Resources)
                  .filter(([, { Type }]) => Type === 'AWS::Logs::LogGroup')
                  .map(([logicalId]) => ({
                    'Fn::GetAtt': [logicalId, 'Arn'],
                  })),
              },
            ],
          },
        },
      ],
    },
  };
  ctx.sls.service.provider.compiledCloudFormationTemplate.Outputs.EnterpriseLogAccessIamRole = {
    Value: {
      'Fn::GetAtt': ['EnterpriseLogAccessIamRole', 'Arn'],
    },
  };
};
