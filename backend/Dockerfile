# ---------- build ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# restore (copy csproj first for layer caching) — chỉ API + deps, không gồm tests
COPY src/GomDon.Api/GomDon.Api.csproj                     src/GomDon.Api/
COPY src/GomDon.Shared/GomDon.Shared.csproj               src/GomDon.Shared/
COPY src/GomDon.Infrastructure/GomDon.Infrastructure.csproj src/GomDon.Infrastructure/
COPY src/GomDon.Modules.Orders/GomDon.Modules.Orders.csproj src/GomDon.Modules.Orders/
RUN dotnet restore src/GomDon.Api/GomDon.Api.csproj

# build + publish
COPY . .
RUN dotnet publish src/GomDon.Api/GomDon.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# ---------- runtime ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish ./
# schema script dùng cho DbBootstrapper
COPY db/init.sql ./db/init.sql

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "GomDon.Api.dll"]
