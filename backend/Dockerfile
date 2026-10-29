FROM public.ecr.aws/lambda/nodejs:22@sha256:f4f30ba3a882589f91824fc850626b7a13c6649131fc3351c252459eae605d94 AS build
WORKDIR /build
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm run prisma:generate
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build
RUN cp /var/runtime/ca-cert.pem rds-global-bundle.pem
RUN node -e "require('fs').writeFileSync('gateway-root-bundle.pem', require('tls').rootCertificates.join('\n'))"

FROM build AS production-dependencies
RUN npm ci --omit=dev --omit=optional --omit=peer --prefer-offline && npm cache clean --force

FROM build AS migration
WORKDIR /var/task
COPY --from=build /build/node_modules ./node_modules
COPY --from=build /build/dist ./dist
COPY --from=build /build/rds-global-bundle.pem ./
COPY --from=build /build/gateway-root-bundle.pem ./
COPY prisma ./prisma
CMD ["dist/schema-migration.handler"]

FROM public.ecr.aws/lambda/nodejs:22@sha256:f4f30ba3a882589f91824fc850626b7a13c6649131fc3351c252459eae605d94 AS runtime
ENV NODE_ENV=production
WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=production-dependencies /build/node_modules ./node_modules
COPY --from=build /build/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /build/dist ./dist
COPY --from=build /build/rds-global-bundle.pem ./
COPY --from=build /build/gateway-root-bundle.pem ./
CMD ["dist/lambda.handler"]
