FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

WORKDIR /src

COPY TodoBench.AspNet.csproj ./
RUN dotnet restore ./TodoBench.AspNet.csproj

COPY . .
RUN dotnet publish ./TodoBench.AspNet.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime

WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8081

COPY --from=build /app/publish ./

EXPOSE 8081

ENTRYPOINT ["dotnet", "TodoBench.AspNet.dll"]