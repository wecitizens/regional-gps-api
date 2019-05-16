#!/usr/bin/env bash

rsync -azP ./* ubuntu@ec2-52-47-66-164.eu-west-3.compute.amazonaws.com:/home/user/demo/api/

# Force to put correct access right on dist
ssh -i ".ssh/wecitizens.pem" ubuntu@ec2-52-47-66-164.eu-west-3.compute.amazonaws.com 'sudo chmod -R 777 /home/user/demo/api/'

ssh -i ".ssh/wecitizens.pem" ubuntu@ec2-52-47-66-164.eu-west-3.compute.amazonaws.com 'cd /home/user/demo/api/ && /home/ubuntu/.nvm/versions/node/v8.11.4/bin/forever start ./bin/www --harmony'