# Cloud Infrastructure Documentation

## AWS Services Used
The infrastructure is built using the following core AWS services:
*   **Amazon VPC (Virtual Private Cloud)**: Provides a private, isolated network environment [1].
*   **Amazon EC2 (Elastic Compute Cloud)**: Hosts the Node.js backend application [1].
*   **Amazon RDS (Relational Database Service)**: Manages the PostgreSQL relational database [1].
*   **AWS Amplify**: Hosts the ReactJS frontend application.
*   **Amazon Internet Gateway**: Provides internet access to the public subnet [1, 2].

---

## 1. High-Level Architecture
The architecture follows a multi-tier design to ensure security and scalability for a production-ready environment [1].

*   **Frontend Tier**: ReactJS application hosted via **AWS Amplify**.
*   **Backend Tier**: Node.js application running on an **Amazon EC2** instance [1].
*   **Database Tier**: Managed **PostgreSQL** instance on **Amazon RDS** [1, 2].

---

## 2. Networking & Connectivity
*   **VPC Configuration**: A production VPC has been established with a CIDR block of `10.0.0.0/16` [2].
*   **Subnet Strategy**:
    *   **Public Subnet**: Hosts the EC2 backend server and is connected to the internet via an **Internet Gateway** [1, 2].
    *   **Private Subnet**: Hosts the RDS database, keeping it isolated from the public internet [1, 2].
*   **Routing**: Dedicated route tables manage traffic flow, ensuring the public subnet can reach the internet [2].
*   **Internal Communication**: The EC2 backend connects to the RDS instance using **private networking** within the AWS infrastructure, ensuring data does not traverse the public internet [2].

---

## 3. Backend Infrastructure (EC2)
*   **Instance Environment**: The backend runs on an **Ubuntu 22.04** EC2 instance [2].
*   **Application Stack**:
    *   **Node.js**: The primary runtime for the backend service [1, 2].
    *   **PM2**: A process manager used to keep the Node.js application running and handle automatic restarts [2].
    *   **Nginx**: Functions as a **reverse proxy server** to manage incoming requests to the Node.js application [2].

---

## 4. Database Infrastructure (RDS)
*   **Database Engine**: Managed **PostgreSQL** [1, 2].
*   **Configuration**: The database is part of a **private DB subnet group**, ensuring it is not accessible from the public internet [2, 3].

---

## 5. Security Implementations
*   **Security Groups**: Act as virtual firewalls to control inbound and outbound traffic for the EC2 and RDS instances [2].
*   **Access Control**:
    *   RDS is **not publicly accessible** [3].
    *   Database access is strictly limited to traffic originating from the **backend security group** [3].
    *   **SSH access** to the EC2 instance is restricted to a specific personal IP address [3].
    *   Security groups are configured with **minimum required access** (Principle of Least Privilege) [3].
*   **Isolation**: Private subnet isolation is enabled for the database tier [3].

---

## 6. Future Enhancements
Planned improvements for the infrastructure include:
*   **HTTPS/SSL**: Setting up encryption using **Certbot and Nginx** [3].
*   **CI/CD**: Implementing automated deployments with **GitHub Actions** [3].
*   **Scalability**: Configuring **Auto Scaling Groups** and RDS **Multi-AZ/Read Replicas** for high availability [3].
*   **Monitoring**: Utilizing **Amazon CloudWatch** for real-time monitoring and performance alarms [3].
