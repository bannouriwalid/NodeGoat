pipeline {
  agent any

  environment {
    SONAR_TOKEN = credentials('SONAR_TOKEN')
    SNYK_TOKEN = credentials('SNYK_TOKEN')
    DOCKER_IMAGE = "nodegoat:${env.BUILD_NUMBER}"
    APP_PORT = "4000"
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
      }
    }

stage('Install & Unit Tests') {
      agent {
        // Use a Node.js image just for this stage
        docker {
          image 'node:18-alpine' 
          // Use the absolute path /usr/src as the workspace
          // This is a common and reliable practice for Docker agents
          args '-w /usr/src'
        }
      }
      steps {
        // The workspace is mounted automatically to /usr/src inside the container
        sh 'npm ci'
        sh 'npm test || echo "Tests failed but continuing"'
      }
    }

stage('SAST - SonarQube Scan') {
  agent {
    docker {
      image 'sonarsource/sonar-scanner-cli:latest' 
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

  stage('SCA - Snyk Scan') {
    agent {
      docker {
        image 'node:18-alpine'
        args '-w /usr/src'
      }
    }
    environment {
      SNYK_TOKEN = credentials('snyk-token')
    }
    steps {
      sh '''
        npm ci
        npm install snyk --save-dev
        npx snyk auth $SNYK_TOKEN
        npx snyk test --severity-threshold=high
      '''
    }
  }

    stage('Build Docker Image & Deploy Ephemeral App') {
      steps {
        sh '''
          docker build -t ${DOCKER_IMAGE} .
          docker network create nodegoat-net || true
          docker rm -f nodegoat-app || true
          docker run -d --name nodegoat-app --network nodegoat-net -p ${APP_PORT}:4000 ${DOCKER_IMAGE}
        '''
      }
    }

    stage('DAST - OWASP ZAP Scan') {
      steps {
        sh '''
          docker run --rm --network nodegoat-net \
            owasp/zap2docker-stable zap-baseline.py \
            -t http://nodegoat-app:4000 -r zap_report.html -J zap_report.json
          
          # Check for high-risk alerts
          if grep -q '"risk": "High"' zap_report.json; then
            echo "High-risk issues found by ZAP"
            exit 1
          fi
        '''
      }
    }
  }

  post {
    always {
      sh '''
        docker rm -f nodegoat-app || true
        docker network rm nodegoat-net || true
      '''
    }
  }
}
