FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY backend/HealthTracker.Api/HealthTracker.Api.csproj backend/HealthTracker.Api/
RUN dotnet restore backend/HealthTracker.Api/HealthTracker.Api.csproj

COPY backend/HealthTracker.Api/ backend/HealthTracker.Api/
RUN dotnet publish backend/HealthTracker.Api/HealthTracker.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet","HealthTracker.Api.dll"]
