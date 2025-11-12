pipeline {
  agent none

  environment {
    SONAR_TOKEN = credentials('SONAR_TOKEN')
    SNYK_TOKEN  = credentials('SNYK_TOKEN')
    DOCKER_IMAGE = "nodegoat:${env.BUILD_NUMBER}"
    MONGO_IMAGE = "mongo:4.4"
    APP_PORT = "4000"
    NETWORK_NAME = "nodegoat-net"
  }

  stages {

    stage('Checkout') {
      agent any
      steps {
        checkout scm
      }
    }

    stage('Install Dependencies & Unit Tests') {
      agent {
        docker {
          image 'node:18-alpine'
          args '-u root'
        }
      }
      steps {
        sh '''
          npm ci
          npm test || echo "Unit tests failed, continuing..."
        '''
      }
    }

    stage('SAST - SonarQube Scan') {
      agent {
        docker {
          image 'sonarsource/sonar-scanner-cli:latest' 
          args '-v $WORKSPACE:/usr/src'
          reuseNode true
        }
      }
      steps {
        withCredentials([string(credentialsId: 'SONAR_TOKEN', variable: 'SONAR_LOGIN')]) {
          sh '''
            sonar-scanner \
              -Dsonar.projectKey=nodegoat \
              -Dsonar.sources=. \
              -Dsonar.host.url=http://host.docker.internal:9000 \
              -Dsonar.login=$SONAR_LOGIN
          '''
        }
      }
    }

    stage('SCA - Snyk') {
      agent {
        docker {
          image 'node:18-alpine'
          args '-u root'
        }
      }
      steps {
        sh '''
          npm install snyk --save-dev
          npx snyk auth ${SNYK_TOKEN}
          npx snyk test --severity-threshold=high || true
        '''
      }
    }

    stage('Build App') {
      agent any
      steps {
        sh 'docker build -t ${DOCKER_IMAGE} .'
      }
    }

    stage('Start MongoDB') {
      agent any
      steps {
        sh '''
          docker rm -f nodegoat-mongo || true
          docker network create ${NETWORK_NAME} || true
          docker run -d --name nodegoat-mongo --network ${NETWORK_NAME} -p 27017:27017 ${MONGO_IMAGE}
        '''
      }
    }

    stage('Run NodeGoat App') {
      agent any
      steps {
        sh '''
          docker rm -f nodegoat-app || true
          docker run -d --name nodegoat-app \
            --network ${NETWORK_NAME} \
            -p ${APP_PORT}:4000 \
            -e MONGODB_URI=mongodb://nodegoat-mongo:27017/nodegoat \
            ${DOCKER_IMAGE} sh -c "until nc -z nodegoat-mongo 27017; do sleep 2; done && node artifacts/db-reset.js && npm start || tail -f /dev/null"

          # Wait for the app to be ready
          for i in {1..20}; do
            if curl -s http://localhost:${APP_PORT} >/dev/null; then break; fi
            sleep 2
          done
        '''
      }
    }

    stage('DAST - OWASP ZAP Scan') {
      agent any
      steps {
        sh '''
          mkdir -p zap-reports
          chmod 777 zap-reports
          WORKDIR=$(pwd)

          docker run --rm -u 0 \
            --network ${NETWORK_NAME} \
            -v "$WORKDIR/zap-reports:/zap/wrk" \
            ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
            -t http://nodegoat-app:4000 \
            -r /zap/wrk/zap_report.html \
            -J /zap/wrk/zap_report.json || true
        '''
      }
    }
  }

  post {
      always {
          script {
              node {
                  sh '''
                      docker rm -f nodegoat-app || true
                      docker rm -f nodegoat-mongo || true
                      docker network rm ${NETWORK_NAME} || true
                      docker rmi -f ${DOCKER_IMAGE} || true
                  '''
              }
          }
      }
  }
}
