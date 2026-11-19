try:
    import pymysql

    # Django mysqlclient versiyasini tekshiradi; PyMySQL'ni shunga moslaymiz
    pymysql.version_info = (2, 2, 7, "final", 0)
    pymysql.install_as_MySQLdb()
except ImportError:  # sqlite bilan sinov uchun
    pass
