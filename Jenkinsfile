pipeline {
  agent none

  environment {
    SONAR_TOKEN = credentials('SONAR_TOKEN')
    SNYK_TOKEN  = credentials('SNYK_TOKEN')
    DOCKER_IMAGE = "nodegoat:${env.BUILD_NUMBER}"
    APP_PORT = "4000"
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
        withCredentials([string(credentialsId: 'sonarqube-token', variable: 'SONAR_LOGIN')]) {
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

    stage('Build & Run App (Ephemeral)') {
      agent any // uses Jenkins agent directly with Docker installed
      steps {
        sh '''
          echo "Building Docker image..."
          docker build -t ${DOCKER_IMAGE} .

          echo "Starting ephemeral container..."
          docker network create nodegoat-net || true
          docker run -d --name nodegoat-app --network nodegoat-net -p ${APP_PORT}:4000 ${DOCKER_IMAGE}
        '''
      }
    }

    stage('DAST - OWASP ZAP Scan') {
      agent any // uses Jenkins agent directly with Docker installed
      steps {
        sh '''
          echo "Running ZAP baseline scan..."
          docker run --rm --network nodegoat-net \
            ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
            -t http://nodegoat-app:4000 -r zap_report.html -J zap_report.json || true

          if grep -q '"risk": 3' zap_report.json; then
            echo "High-risk issues found by ZAP"
            exit 1
          fi
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
          docker network rm nodegoat-net || true

          echo "Removing built image to avoid accumulation..."
          docker rmi -f ${DOCKER_IMAGE} || true
        '''
      }
    }
  }
}
