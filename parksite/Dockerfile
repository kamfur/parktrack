##See https://aka.ms/containerfastmode to understand how Visual Studio uses this Dockerfile to build your images for faster debugging.
#
#FROM mcr.microsoft.com/dotnet/core/aspnet:3.1-buster-slim AS base
#WORKDIR /app
#EXPOSE 80
#EXPOSE 443
#
#FROM mcr.microsoft.com/dotnet/core/sdk:3.1-buster AS build
#WORKDIR /src
#COPY ["parksite/parksite.csproj", "parksite/"]
#RUN dotnet restore "parksite/parksite.csproj"
#COPY . .
#WORKDIR "/src/parksite"
#RUN dotnet build "parksite.csproj" -c Release -o /app/build
#
#FROM build AS publish
#RUN dotnet publish "parksite.csproj" -c Release -o /app/publish
#
#FROM base AS final
#WORKDIR /app
#COPY --from=publish /app/publish .
#ENTRYPOINT ["dotnet", "parksite.dll"]

# Use the .NET 6 runtime as the base image
FROM mcr.microsoft.com/dotnet/aspnet:6.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

# Use the .NET 6 SDK as the build image
FROM mcr.microsoft.com/dotnet/sdk:6.0 AS build
WORKDIR /src
COPY ["parksite/parksite.csproj", "parksite/"]
RUN dotnet restore "parksite/parksite.csproj"
COPY . .
WORKDIR "/src/parksite"
RUN dotnet build "parksite.csproj" -c Release -o /app/build

# Publish the application
FROM build AS publish
RUN dotnet publish "parksite.csproj" -c Release -o /app/publish

# Build the final image
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "parksite.dll"]
