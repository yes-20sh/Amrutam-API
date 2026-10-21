# Amrutam - Telemedicine & Doctor Consultation Platform

A modern, enterprise-grade Telemedicine and Doctor Consultation platform built with **NestJS**, **GraphQL (Apollo Server Code-First)**, **TypeORM**, **PostgreSQL**, and **Redis**.

---

## 🌟 Highlights

- **Doctor Scheduling & Slot Engine**: Real-time availability slot generation with 30-minute intervals and transactional concurrency locks to prevent double-booking.
- **Zero-Trust Security & 2FA**: Dual-mode JWT authentication (Bearer token & secure HTTP-only cookies) with TOTP Multi-Factor Authentication (MFA).
- **Consultation & Prescriptions**: Complete consultation lifecycle from booking and status transitions to structured digital prescription creation.
- **Integrated Payments & Auditing**: End-to-end payment initiation and settlement with automatic PostgreSQL audit log capture on exceptions.
- **Production CI/CD & Quality Gates**: Automated GitHub Actions deployment pipeline for Vercel Serverless with Husky pre-commit hooks (ESLint/Oxlint, NestJS build, and high-severity vulnerability audit).

---

## 📂 Repository Structure

- [`api/`](file:///e:/Amrutam-API/api): The core backend service containing all domain feature slices, database entities, and GraphQL resolvers.
  - Detailed documentation: [api/README.md](file:///e:/Amrutam-API/api/README.md)
  - Bruno API Collection: [`api/.bruno/`](file:///e:/Amrutam-API/api/.bruno)
- [`.github/workflows/`](file:///e:/Amrutam-API/.github/workflows): Automated CI/CD pipelines for PR validation and production deployments.

---

## 🚀 Quick Start

```bash
# 1. Navigate to the API service
cd api

# 2. Install dependencies
bun install
# or: npm install

# 3. Configure environment
cp .example.env .env

# 4. Start local development server
bun run start:dev
# or: npm run start:dev
```

GraphQL Playground and schema exploration is accessible at `http://localhost:8000/graphql`.

For full database schema definitions, user flows, architecture deep dives, and API query samples, refer to the [API Documentation](file:///e:/Amrutam-API/api/README.md).

---

## 📄 License

This project is open-source and licensed under the [MIT License](file:///e:/Amrutam-API/LICENSE).