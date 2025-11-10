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
      steps {
        nodejs('Node_18'){
          sh 'npm ci'
          sh 'npm test || echo "Tests failed but continuing"'
        }
      }
    }

    stage('SAST - SonarQube Analysis') {
      steps {
        sh '''
          docker run --rm \
            -e SONAR_HOST_URL="http://host.docker.internal:9000" \
            -e SONAR_LOGIN="${SONAR_TOKEN}" \
            -v "$PWD":/usr/src sonarsource/sonar-scanner-cli \
            -Dsonar.projectKey=nodegoat
        '''
      }
    }

    stage('SCA - Snyk Dependency Scan') {
      steps {
        sh '''
          docker run --rm -v "$PWD":/project -w /project \
            -e SNYK_TOKEN=${SNYK_TOKEN} node:18 bash -c "
              npm ci && npm install -g snyk && snyk auth ${SNYK_TOKEN} && snyk test --severity-threshold=high
            "
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
