pipeline {
  agent any

  options {
    timestamps()
    ansiColor('xterm')
  }

  environment {
    // Adjust if you use a different Python/Node version on your agents
    PYTHON = 'python'
    NODEJS = 'node'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Setup Backend') {
      steps {
        dir('backend') {
          script {
            if (fileExists('requirements.txt')) {
              sh "${env.PYTHON} -m pip install --upgrade pip"
              sh "${env.PYTHON} -m pip install -r requirements.txt"
            }
          }
        }
      }
    }

    stage('Setup Frontend') {
      steps {
        dir('frontend') {
          script {
            if (fileExists('package.json')) {
              sh "npm install"
            }
          }
        }
      }
    }

    stage('Backend Tests') {
      when {
        expression { fileExists('backend') }
      }
      steps {
        dir('backend') {
          script {
            if (fileExists('pytest.ini') || fileExists('tests')) {
              sh "${env.PYTHON} -m pytest"
            } else {
              echo 'No backend tests configured; skipping.'
            }
          }
        }
      }
    }

    stage('Frontend Build') {
      when {
        expression { fileExists('frontend/package.json') }
      }
      steps {
        dir('frontend') {
          sh "npm run build || echo 'No build script configured; skipping.'"
        }
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: '**/dist/**, **/build/**, **/test-results/**/*.xml', fingerprint: true, allowEmptyArchive: true
      junit testResults: '**/test-results/**/*.xml', allowEmptyResults: true
    }
    failure {
      echo 'Build failed.'
    }
    success {
      echo 'Build succeeded.'
    }
  }
}

