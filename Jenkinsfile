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
          echo "Installing dependencies..."
          npm ci
          echo "Running unit tests..."
          npm test || echo "Tests failed but continuing"
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
          echo "Running Snyk scan..."
          npm install snyk --save-dev
          npx snyk auth ${SNYK_TOKEN}
          npx snyk test --severity-threshold=high || true
        '''
      }
    }

    stage('Build (Ephemeral)') {
      agent any // uses Jenkins agent directly with Docker installed
      steps {
        sh '''
          echo "Building Docker image..."
          docker build -t ${DOCKER_IMAGE} .
        '''
      }
    }

    stage('Start MongoDB') {
      agent any
      steps {
        sh '''
          echo "Removing old Mongo container if exists..."
          docker rm -f nodegoat-mongo || true

          echo "Creating network if not exists..."
          docker network create ${NETWORK_NAME} || true

          echo "Starting MongoDB container..."
          docker run -d --name nodegoat-mongo \
            --network ${NETWORK_NAME} \
            -p 27017:27017 \
            ${MONGO_IMAGE}
        '''
      }
    }

    stage('Run NodeGoat App') {
      agent any
      steps {
        sh '''
          echo "Removing old NodeGoat container if exists..."
          docker rm -f nodegoat-app || true

          echo "Starting NodeGoat container..."
          docker run -d --name nodegoat-app \
            --network ${NETWORK_NAME} \
            -p ${APP_PORT}:4000 \
            -e MONGODB_URI=mongodb://nodegoat-mongo:27017/nodegoat \
            ${DOCKER_IMAGE} sh -c "until nc -z nodegoat-mongo 27017 && echo 'Mongo ready'; do sleep 2; done && node artifacts/db-reset.js && npm start || tail -f /dev/null"

          echo "Waiting for NodeGoat to be ready..."
          for i in {1..20}; do
            if curl -s http://localhost:${APP_PORT} >/dev/null; then
              echo "NodeGoat is up!"
              break
            fi
            echo "Waiting..."
            sleep 2
          done

          echo "Running containers:"
          docker ps
        '''
      }
    }

    stage('DAST - OWASP ZAP Scan') {
      agent any
      steps {
        sh '''
          echo "Running ZAP baseline scan..."
          mkdir -p zap-reports
          chmod 777 zap-reports
    
          WORKDIR=$(pwd)
          echo "Working dir: $WORKDIR"
    
          docker run --rm -u 0 \
            --network ${NETWORK_NAME} \
            -v "$WORKDIR/zap-reports:/zap/wrk" \
            ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
            -t http://nodegoat-app:4000 \
            -r zap_report.html \
            -J zap_report.json || true
          '''
      }
    }
  }

  post {
    always {
      steps {
        sh '''
          echo "Cleaning up containers and networks..."
          docker rm -f nodegoat-app || true
          docker rm -f nodegoat-mongo || true
          docker network rm ${NETWORK_NAME} || true
          echo "Removing built image to avoid accumulation..."
          # docker rmi -f ${DOCKER_IMAGE} || true
        '''
      }
    }
  }
}
